import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

/** Identity-only scopes — this is sign-in, not the Calendar/Gmail data integration. */
const LOGIN_SCOPES = ['openid', 'email', 'profile'];

interface LoginState {
  kind: string;
}

/**
 * "Continue with Google" (FR-1). If the verified Google email matches an existing
 * member → sign them in (activating an invited member). If not → **create a new
 * workspace with that person as the owner** (sign-up). Reuses the same Google OAuth
 * client as the data integration, with its own redirect URI (GOOGLE_AUTH_REDIRECT_URI).
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  /** Whether sign-in with Google is configured (client id/secret present). */
  get configured(): boolean {
    return !!this.config.get<string>('GOOGLE_CLIENT_ID') && !!this.config.get<string>('GOOGLE_CLIENT_SECRET');
  }

  private oauthClient() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      this.config.get<string>('GOOGLE_AUTH_REDIRECT_URI') ??
      'http://localhost:4000/v1/auth/google/callback';
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google sign-in is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /** Build the Google consent URL; the signed `state` guards against CSRF. */
  async authUrl(): Promise<string> {
    const state = await this.jwt.signAsync({ kind: 'google_login' }, { expiresIn: '10m' });
    return this.oauthClient().generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: LOGIN_SCOPES,
      state,
    });
  }

  /** Exchange the code, verify the identity token, and sign in the matching member. */
  async handleCallback(code: string, state: string): Promise<{ token: string }> {
    try {
      const payload = await this.jwt.verifyAsync<LoginState>(state);
      if (payload.kind !== 'google_login') throw new Error('bad state');
    } catch {
      throw new BadRequestException('Invalid or expired sign-in state');
    }

    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException('Google did not return an identity token');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });
    const profile = ticket.getPayload();
    if (!profile?.email || !profile.email_verified) {
      throw new UnauthorizedException('Your Google email is not verified');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: profile.email, deletedAt: null, status: { not: 'deactivated' } },
      include: { organization: true, role: true },
      orderBy: { lastLoginAt: 'desc' },
    });

    // No matching member → this Google user becomes the OWNER of a brand-new workspace.
    if (!user) {
      return this.auth.signupWithGoogle({ email: profile.email, name: profile.name ?? null });
    }

    // Existing member → sign in (and activate an invited member who chose Google).
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date(), status: 'active' },
    });
    const role = user.role?.name ?? 'Member';
    const token = await this.jwt.signAsync({ sub: user.id, orgId: user.orgId, role });
    return { token };
  }
}

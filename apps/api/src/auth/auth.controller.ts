import { Body, ConflictException, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/email-flows.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthContext } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1 of "Sign in with Google": redirect the browser to Google's consent
   * screen. The mobile app passes `platform=mobile` + its own `redirect` URI so
   * the callback can hand the token straight back to the app via a deep link.
   */
  @Get('google')
  async google(
    @Res() res: Response,
    @Query('mode') mode?: string,
    @Query('platform') platform?: string,
    @Query('redirect') redirect?: string,
  ) {
    return res.redirect(
      await this.googleAuth.authUrl(
        mode === 'signup' ? 'signup' : 'login',
        platform === 'mobile' ? 'mobile' : 'web',
        redirect,
      ),
    );
  }

  /** Step 2: Google redirects here; we hand the app JWT back to the web app (query param) or the mobile app (deep link). */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    if (error || !code || !state) return res.redirect(`${appUrl}/login?error=google`);
    try {
      const { token, platform, redirect } = await this.googleAuth.handleCallback(code, state);
      if (platform === 'mobile' && redirect) {
        const sep = redirect.includes('?') ? '&' : '?';
        return res.redirect(`${redirect}${sep}token=${encodeURIComponent(token)}`);
      }
      return res.redirect(`${appUrl}/login?token=${encodeURIComponent(token)}`);
    } catch (e) {
      // Don't collapse every failure into one code: a ConflictException means the email *does* have
      // an account, and reporting "no account for that email" sent us hunting in the wrong direction.
      const code = e instanceof ConflictException ? 'google_exists' : 'google';
      return res.redirect(`${appUrl}/login?error=${code}`);
    }
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('accept-invite')
  @HttpCode(200)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto);
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthContext) {
    return this.auth.me(user.userId, user.orgId);
  }
}

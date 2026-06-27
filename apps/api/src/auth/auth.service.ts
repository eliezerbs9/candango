import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TokensService } from '../tokens/tokens.service';
import { slugify } from '../common/slug';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/email-flows.dto';

// TODO(prod): switch hashing to argon2id per Multi-Tenancy & Security doc.
const SALT_ROUNDS = 10;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly tokens: TokensService,
  ) {}

  /** Create an organization (tenant) + an Admin role + the first admin user (email/password). */
  async signup(dto: SignupDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { org, user } = await this.prisma.$tx((tx) =>
      this.provisionWorkspace(tx, { orgName: dto.orgName, email: dto.email, name: dto.name ?? null, passwordHash }),
    );

    // Send an email-verification link (the account is usable immediately; this
    // just confirms ownership of the address).
    const verifyToken = await this.tokens.issue(org.id, user.id, 'email_verify', VERIFY_TTL_MS);
    await this.mail.sendEmailVerification(user.email, user.name, verifyToken);

    const token = await this.signToken(user.id, org.id, 'Admin');
    return { token, user: this.publicUser(user, org.name, 'Admin') };
  }

  /**
   * Sign up with Google: the person becomes the OWNER of a brand-new workspace
   * (no password — they log in with Google). The workspace gets a default name they
   * can rename in Settings. Their Google email is already verified.
   */
  async signupWithGoogle(opts: { email: string; name: string | null }) {
    const first = opts.name?.trim().split(/\s+/)[0] || opts.email.split('@')[0];
    const orgName = `${first}'s workspace`;
    const { org, user } = await this.prisma.$tx((tx) =>
      this.provisionWorkspace(tx, { orgName, email: opts.email, name: opts.name, passwordHash: null, emailVerified: true }),
    );
    return { token: await this.signToken(user.id, org.id, 'Admin'), user: this.publicUser(user, org.name, 'Admin') };
  }

  /** Shared workspace provisioning: org + system roles + owner user + default pipeline/stages. */
  private async provisionWorkspace(
    tx: Prisma.TransactionClient,
    opts: { orgName: string; email: string; name: string | null; passwordHash: string | null; emailVerified?: boolean },
  ) {
    const slug = `${slugify(opts.orgName)}-${Math.random().toString(36).slice(2, 7)}`;
    const org = await tx.organization.create({ data: { name: opts.orgName, slug } });
    // The three built-in roles are system roles — protected from edit/delete in the UI;
    // admins add their own custom roles on top (FR-6.3).
    const adminRole = await tx.role.create({
      data: { orgId: org.id, name: 'Admin', isSystem: true, permissions: ['*'], visibility: 'org' },
    });
    await tx.role.createMany({
      data: [
        {
          orgId: org.id,
          name: 'Manager',
          isSystem: true,
          permissions: ['deals:read', 'deals:write', 'persons:read', 'persons:write', 'pipelines:manage', 'reports:read'],
          visibility: 'team',
        },
        {
          orgId: org.id,
          name: 'Rep',
          isSystem: true,
          permissions: ['deals:read', 'deals:write', 'persons:read', 'persons:write'],
          visibility: 'own',
        },
      ],
    });
    const user = await tx.user.create({
      data: {
        orgId: org.id,
        email: opts.email,
        name: opts.name,
        passwordHash: opts.passwordHash,
        roleId: adminRole.id,
        status: 'active',
        ...(opts.emailVerified ? { emailVerifiedAt: new Date() } : {}),
      },
    });

    // Seed a default pipeline + stages so the workspace is usable immediately
    // (see Tenant Onboarding: "a default is seeded").
    const pipeline = await tx.pipeline.create({
      data: { orgId: org.id, name: 'Sales Pipeline', isDefault: true, position: 0 },
    });
    await tx.stage.createMany({
      data: [
        { orgId: org.id, pipelineId: pipeline.id, name: 'Lead', position: 0, probability: 10 },
        { orgId: org.id, pipelineId: pipeline.id, name: 'Qualified', position: 1, probability: 25 },
        { orgId: org.id, pipelineId: pipeline.id, name: 'Proposal', position: 2, probability: 50 },
        { orgId: org.id, pipelineId: pipeline.id, name: 'Negotiation', position: 3, probability: 75 },
      ],
    });
    return { org, user };
  }

  /** Sends a password-reset link. Always succeeds (never reveals whether the email exists). */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null, status: { not: 'deactivated' } },
    });
    if (user) {
      const token = await this.tokens.issue(user.orgId, user.id, 'password_reset', RESET_TTL_MS);
      await this.mail.sendPasswordReset(user.email, user.name, token);
    }
    return { ok: true };
  }

  /** Consumes a reset token and sets a new password. */
  async resetPassword(dto: ResetPasswordDto) {
    const { userId } = await this.tokens.consume('password_reset', dto.token);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  /** Consumes an invite token, activates the user, sets a password, and signs them in. */
  async acceptInvite(dto: AcceptInviteDto) {
    const { userId } = await this.tokens.consume('invite', dto.token);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        status: 'active',
        emailVerifiedAt: new Date(),
        ...(dto.name ? { name: dto.name } : {}),
      },
      include: { organization: true, role: true },
    });

    const role = user.role?.name ?? 'Member';
    const token = await this.signToken(user.id, user.orgId, role);
    return { token, user: this.publicUser(user, user.organization.name, role) };
  }

  /** Consumes an email-verification token and stamps the user verified. */
  async verifyEmail(dto: VerifyEmailDto) {
    const { userId } = await this.tokens.consume('email_verify', dto.token);
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return { ok: true };
  }

  async login(dto: LoginDto) {
    // NOTE: email is unique per org; for dev we match the first user with this email.
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { organization: true, role: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const role = user.role?.name ?? 'Member';
    const token = await this.signToken(user.id, user.orgId, role);
    return { token, user: this.publicUser(user, user.organization.name, role) };
  }

  /** Tenant-scoped current-user lookup. */
  async me(userId: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
      include: { organization: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user, user.organization.name, user.role?.name ?? 'Member');
  }

  private signToken(userId: string, orgId: string, role: string) {
    return this.jwt.signAsync({ sub: userId, orgId, role });
  }

  private publicUser(
    user: { id: string; email: string; name: string | null; orgId: string },
    orgName: string,
    role: string,
  ) {
    return { id: user.id, email: user.email, name: user.name, orgId: user.orgId, orgName, role };
  }
}

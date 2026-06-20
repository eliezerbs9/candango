import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

// TODO(prod): switch hashing to argon2id per Multi-Tenancy & Security doc.
const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Create an organization (tenant) + an Admin role + the first admin user. */
  async signup(dto: SignupDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const slug = `${slugify(dto.orgName)}-${Math.random().toString(36).slice(2, 7)}`;

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.orgName, slug },
      });
      const role = await tx.role.create({
        data: { orgId: org.id, name: 'Admin', isSystem: false, permissions: ['*'], visibility: 'org' },
      });
      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email: dto.email,
          name: dto.name ?? null,
          passwordHash,
          roleId: role.id,
          status: 'active',
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
    });

    const token = await this.signToken(user.id, org.id, 'Admin');
    return { token, user: this.publicUser(user, org.name, 'Admin') };
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

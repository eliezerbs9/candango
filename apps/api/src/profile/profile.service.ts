import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

const SALT_ROUNDS = 10;

function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  const i = t.indexOf(' ');
  return i === -1 ? { firstName: t, lastName: '' } : { firstName: t.slice(0, i), lastName: t.slice(i + 1) };
}

/** Prefer explicit first/last; else split `name`; else null (name-unrelated update). */
function resolveName(
  dto: { firstName?: string; lastName?: string; name?: string },
  existing: { firstName: string; lastName: string },
): { firstName: string; lastName: string; name: string } | null {
  let firstName: string;
  let lastName: string;
  if (dto.firstName !== undefined || dto.lastName !== undefined) {
    firstName = (dto.firstName ?? existing.firstName).trim();
    lastName = (dto.lastName ?? existing.lastName).trim();
  } else if (dto.name !== undefined) {
    const s = splitFullName(dto.name);
    firstName = s.firstName;
    lastName = s.lastName;
  } else {
    return null;
  }
  return { firstName, lastName, name: [firstName, lastName].filter(Boolean).join(' ').trim() };
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
      include: { organization: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.shape(user);
  }

  async update(userId: string, orgId: string, dto: UpdateProfileDto) {
    const existing = await this.ensure(userId, orgId);
    const resolved = resolveName(dto, { firstName: existing.firstName, lastName: existing.lastName });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(resolved ? { firstName: resolved.firstName, lastName: resolved.lastName, name: resolved.name || null } : {}),
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
      },
      include: { organization: true, role: true },
    });
    return this.shape(user);
  }

  async changePassword(userId: string, orgId: string, dto: ChangePasswordDto) {
    const user = await this.ensure(userId, orgId);
    if (!user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  private async ensure(userId: string, orgId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private shape(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    name: string | null;
    phone: string | null;
    avatarUrl: string | null;
    orgId: string;
    organization: { name: string };
    role: { name: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      orgId: user.orgId,
      orgName: user.organization.name,
      role: user.role?.name ?? 'Member',
    };
  }
}

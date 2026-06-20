import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

const SALT_ROUNDS = 10;

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
    await this.ensure(userId, orgId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone, avatarUrl: dto.avatarUrl },
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
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      orgId: user.orgId,
      orgName: user.organization.name,
      role: user.role?.name ?? 'Member',
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  roleId: string | null;
  status: string;
  role: { name: string } | null;
};

const shape = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roleId: u.roleId,
  role: u.role?.name ?? 'Member',
  status: u.status,
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(shape);
  }

  private async ensureRole(orgId: string, roleId?: string | null) {
    if (roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: roleId, orgId } });
      if (!role) throw new BadRequestException('Invalid role');
    }
  }

  async invite(orgId: string, dto: InviteUserDto) {
    await this.ensureRole(orgId, dto.roleId);
    const existing = await this.prisma.user.findFirst({ where: { orgId, email: dto.email } });
    if (existing) throw new ConflictException('A member with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        orgId,
        email: dto.email,
        name: dto.name ?? null,
        roleId: dto.roleId ?? null,
        status: 'invited',
      },
      include: { role: true },
    });
    return shape(user);
  }

  async update(orgId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, orgId } });
    if (!user) throw new NotFoundException('Member not found');
    if (dto.roleId !== undefined) await this.ensureRole(orgId, dto.roleId);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: dto.roleId, status: dto.status },
      include: { role: true },
    });
    return shape(updated);
  }

  async deactivate(orgId: string, id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException("You can't deactivate yourself");
    const user = await this.prisma.user.findFirst({ where: { id, orgId } });
    if (!user) throw new NotFoundException('Member not found');
    await this.prisma.user.update({ where: { id }, data: { status: 'deactivated' } });
  }
}

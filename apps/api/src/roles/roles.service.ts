import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const roles = await this.prisma.role.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, visibility: true, permissions: true, isSystem: true },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      visibility: r.visibility,
      isSystem: r.isSystem,
      scopes: (r.permissions as string[]) ?? [],
    }));
  }
}

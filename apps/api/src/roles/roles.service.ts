import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/** Permission scopes a custom role can grant. The wildcard `*` is reserved for the system Admin role. */
export const SCOPE_CATALOG = [
  { value: 'deals:read', label: 'View deals' },
  { value: 'deals:write', label: 'Create & edit deals' },
  { value: 'deals:delete', label: 'Delete deals' },
  { value: 'persons:read', label: 'View contacts & companies' },
  { value: 'persons:write', label: 'Create & edit contacts & companies' },
  { value: 'pipelines:manage', label: 'Manage pipelines & stages' },
  { value: 'reports:read', label: 'View reports' },
  { value: 'webhooks:manage', label: 'Manage webhooks' },
  { value: 'apikeys:manage', label: 'Manage API keys' },
  { value: 'users:manage', label: 'Manage members & roles' },
  { value: 'billing:manage', label: 'Manage billing' },
  { value: 'integrations:manage', label: 'Manage integrations' },
] as const;

const VALID_SCOPES = new Set<string>(SCOPE_CATALOG.map((s) => s.value));

type RoleRow = {
  id: string;
  name: string;
  visibility: string;
  isSystem: boolean;
  permissions: unknown;
};

const shape = (r: RoleRow) => ({
  id: r.id,
  name: r.name,
  visibility: r.visibility,
  isSystem: r.isSystem,
  scopes: (r.permissions as string[]) ?? [],
});

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The scope catalog the role editor offers (value + human label). */
  scopes() {
    return SCOPE_CATALOG;
  }

  async list(orgId: string) {
    const roles = await this.prisma.role.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, visibility: true, permissions: true, isSystem: true },
    });
    return roles.map(shape);
  }

  private validateScopes(scopes: string[]) {
    const invalid = scopes.filter((s) => !VALID_SCOPES.has(s));
    if (invalid.length) throw new BadRequestException(`Unknown scope(s): ${invalid.join(', ')}`);
  }

  async create(orgId: string, dto: CreateRoleDto) {
    this.validateScopes(dto.scopes);
    const exists = await this.prisma.role.findFirst({ where: { orgId, name: dto.name } });
    if (exists) throw new ConflictException('A role with this name already exists');
    const role = await this.prisma.role.create({
      data: {
        orgId,
        name: dto.name,
        visibility: dto.visibility,
        permissions: dto.scopes,
        isSystem: false,
      },
    });
    return shape(role);
  }

  private async getEditable(orgId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, orgId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be modified');
    return role;
  }

  async update(orgId: string, id: string, dto: UpdateRoleDto) {
    await this.getEditable(orgId, id);
    if (dto.scopes) this.validateScopes(dto.scopes);
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        visibility: dto.visibility,
        ...(dto.scopes ? { permissions: dto.scopes } : {}),
      },
    });
    return shape(role);
  }

  async remove(orgId: string, id: string) {
    await this.getEditable(orgId, id);
    const inUse = await this.prisma.user.count({ where: { orgId, roleId: id, deletedAt: null } });
    if (inUse > 0) {
      throw new ConflictException(`Reassign the ${inUse} member(s) on this role before deleting it`);
    }
    await this.prisma.role.delete({ where: { id } });
  }
}

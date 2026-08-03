import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';
import { INTEGRATION_FIELDS, SYSTEM_FIELDS } from './system-fields';

function keyify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/[\s_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  );
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string, entity?: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { orgId, entity: entity || undefined },
      orderBy: [{ entity: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * The full field catalog for an entity: the built-in essential fields, any connected-integration
   * fields (e.g. QuickBooks), and the org's editable custom fields. Used by the Fields settings page.
   */
  async schema(orgId: string, entity: string) {
    const system = SYSTEM_FIELDS[entity] ?? [];
    const qbConnected =
      (await this.prisma.quickBooksConnection.count({ where: { orgId, status: 'connected' } })) > 0;
    const integration = qbConnected ? (INTEGRATION_FIELDS[entity] ?? []) : [];
    const custom = await this.list(orgId, entity);
    return { system, integration, custom };
  }

  async create(orgId: string, dto: CreateCustomFieldDto) {
    let key = keyify(dto.label);
    const exists = await this.prisma.customFieldDefinition.findFirst({
      where: { orgId, entity: dto.entity, key },
    });
    if (exists) key = `${key}_${randomBytes(2).toString('hex')}`;

    return this.prisma.customFieldDefinition.create({
      data: {
        orgId,
        entity: dto.entity,
        key,
        label: dto.label,
        type: dto.type ?? 'text',
        options: dto.type === 'select' ? (dto.options ?? []) : [],
        required: dto.required ?? false,
        // Conditional-required only applies to deals.
        requiredFromStageId: dto.entity === 'deal' ? (dto.requiredFromStageId ?? null) : null,
        requiredForWon: dto.entity === 'deal' ? (dto.requiredForWon ?? false) : false,
        position: dto.position ?? 0,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateCustomFieldDto) {
    const existing = await this.ensure(orgId, id);
    const isDeal = existing.entity === 'deal';
    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.options !== undefined ? { options: dto.options } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.requiredFromStageId !== undefined ? { requiredFromStageId: isDeal ? dto.requiredFromStageId : null } : {}),
        ...(dto.requiredForWon !== undefined ? { requiredForWon: isDeal ? dto.requiredForWon : false } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.ensure(orgId, id);
    await this.prisma.customFieldDefinition.delete({ where: { id } });
  }

  private async ensure(orgId: string, id: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({ where: { id, orgId } });
    if (!field) throw new NotFoundException('Custom field not found');
    return field;
  }
}

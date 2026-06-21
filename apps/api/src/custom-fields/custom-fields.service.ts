import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';

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
        position: dto.position ?? 0,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateCustomFieldDto) {
    await this.ensure(orgId, id);
    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: { label: dto.label, type: dto.type, options: dto.options, position: dto.position },
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

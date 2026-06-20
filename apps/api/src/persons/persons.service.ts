import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person.dto';

type PersonRow = {
  id: string;
  name: string;
  emails: Prisma.JsonValue;
  phones: Prisma.JsonValue;
  companyId: string | null;
};

function shape(p: PersonRow) {
  const emails = (p.emails as string[]) ?? [];
  const phones = (p.phones as string[]) ?? [];
  return { id: p.id, name: p.name, email: emails[0] ?? null, phone: phones[0] ?? null, companyId: p.companyId };
}

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.person.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(shape);
  }

  async create(orgId: string, dto: CreatePersonDto) {
    const row = await this.prisma.person.create({
      data: {
        orgId,
        name: dto.name,
        emails: dto.email ? [dto.email] : [],
        phones: dto.phone ? [dto.phone] : [],
        companyId: dto.companyId ?? null,
      },
    });
    return shape(row);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.person.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!row) throw new NotFoundException('Person not found');
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdatePersonDto) {
    await this.get(orgId, id);
    const data: Prisma.PersonUncheckedUpdateInput = {
      name: dto.name,
      companyId: dto.companyId ?? undefined,
    };
    if (dto.email !== undefined) data.emails = dto.email ? [dto.email] : [];
    if (dto.phone !== undefined) data.phones = dto.phone ? [dto.phone] : [];
    const row = await this.prisma.person.update({ where: { id }, data });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.person.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

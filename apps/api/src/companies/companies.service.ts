import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.company.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, domain: true },
    });
  }

  create(orgId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: { orgId, name: dto.name, domain: dto.domain ?? null },
      select: { id: true, name: true, domain: true },
    });
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.company.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true, name: true, domain: true },
    });
    if (!row) throw new NotFoundException('Company not found');
    return row;
  }

  async update(orgId: string, id: string, dto: UpdateCompanyDto) {
    await this.get(orgId, id);
    return this.prisma.company.update({
      where: { id },
      data: { name: dto.name, domain: dto.domain },
      select: { id: true, name: true, domain: true },
    });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

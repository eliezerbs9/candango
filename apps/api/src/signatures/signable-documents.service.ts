import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSignableDocumentDto, UpdateSignableDocumentDto } from './dto/signable-document.dto';

const shape = (r: {
  id: string;
  dealId: string | null;
  name: string;
  mode: string;
  parties: string;
  party2Source: string;
  party2UserId: string | null;
  initialsRule: string;
  initialsPages: unknown;
  initialsParty: string;
  bodyHtml: string;
  layout: unknown;
  theme: unknown;
  fileKey: string | null;
  fields: unknown;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  dealId: r.dealId,
  name: r.name,
  mode: r.mode,
  parties: r.parties,
  party2Source: r.party2Source,
  party2UserId: r.party2UserId,
  initialsRule: r.initialsRule,
  initialsPages: (r.initialsPages as number[] | null) ?? [],
  initialsParty: r.initialsParty,
  bodyHtml: r.bodyHtml,
  layout: (r.layout as unknown[] | null) ?? [],
  theme: (r.theme as Record<string, unknown> | null) ?? {},
  fileKey: r.fileKey,
  fields: (r.fields as unknown[] | null) ?? [],
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

@Injectable()
export class SignableDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reusable templates only — one-off deal documents (dealId set) are excluded. */
  async list(orgId: string) {
    const rows = await this.prisma.signableDocumentTemplate.findMany({ where: { orgId, dealId: null, archivedAt: null }, orderBy: { createdAt: 'asc' } });
    return rows.map(shape);
  }

  /** One-off documents drafted for a specific deal (newest first) — shown on the deal's Signatures tab. */
  async listForDeal(orgId: string, dealId: string) {
    const rows = await this.prisma.signableDocumentTemplate.findMany({ where: { orgId, dealId, archivedAt: null }, orderBy: { createdAt: 'desc' } });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.signableDocumentTemplate.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!row) throw new NotFoundException('Document template not found');
    return row;
  }

  async getOne(orgId: string, id: string) {
    return shape(await this.get(orgId, id));
  }

  async create(orgId: string, userId: string, dto: CreateSignableDocumentDto) {
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        dealId: dto.dealId ?? null,
        name: dto.name.trim(),
        mode: dto.mode ?? 'html',
        parties: dto.parties ?? 'one',
        party2Source: dto.party2Source ?? 'owner',
        party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null,
        initialsRule: dto.initialsRule ?? 'none',
        initialsPages: dto.initialsPages ?? [],
        initialsParty: dto.initialsParty ?? 'client',
        bodyHtml: dto.bodyHtml ?? '',
        layout: (dto.layout ?? []) as object,
        theme: (dto.theme ?? {}) as object,
        fileKey: dto.fileKey ?? null,
        fields: (dto.fields ?? []) as object,
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateSignableDocumentDto) {
    await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.parties !== undefined ? { parties: dto.parties } : {}),
        ...(dto.party2Source !== undefined ? { party2Source: dto.party2Source, party2UserId: dto.party2Source === 'user' ? dto.party2UserId ?? null : null } : dto.party2UserId !== undefined ? { party2UserId: dto.party2UserId } : {}),
        ...(dto.initialsRule !== undefined ? { initialsRule: dto.initialsRule } : {}),
        ...(dto.initialsPages !== undefined ? { initialsPages: dto.initialsPages } : {}),
        ...(dto.initialsParty !== undefined ? { initialsParty: dto.initialsParty } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout as object } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as object } : {}),
        ...(dto.fileKey !== undefined ? { fileKey: dto.fileKey } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields as object } : {}),
      },
    });
    return shape(row);
  }

  /** Copy a reusable template into a one-off document for a deal (opened in the builder, sent from there). */
  async duplicateForDeal(orgId: string, userId: string, id: string, dealId: string) {
    const src = await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        dealId,
        name: src.name,
        mode: src.mode,
        parties: src.parties,
        party2Source: src.party2Source,
        party2UserId: src.party2UserId,
        initialsRule: src.initialsRule,
        initialsPages: src.initialsPages as object,
        initialsParty: src.initialsParty,
        bodyHtml: src.bodyHtml,
        layout: src.layout as object,
        theme: src.theme as object,
        fileKey: src.fileKey,
        fields: src.fields as object,
      },
    });
    return shape(row);
  }

  /** A name unique within the deal: "Doc" → "Doc (2)" → "Doc (3)". Considers drafts + sent request titles. */
  private async dedupeName(orgId: string, dealId: string, name: string): Promise<string> {
    const root = name.replace(/\s*\(\d+\)\s*$/, '').trim() || 'Untitled document';
    const [drafts, reqs] = await Promise.all([
      this.prisma.signableDocumentTemplate.findMany({ where: { orgId, dealId, archivedAt: null }, select: { name: true } }),
      this.prisma.signatureRequest.findMany({ where: { orgId, dealId }, select: { title: true } }),
    ]);
    const esc = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${esc}(?:\\s*\\((\\d+)\\))?$`);
    let maxN = 0;
    for (const nm of [...drafts.map((d) => d.name), ...reqs.map((r) => r.title)]) {
      const m = re.exec(nm.trim());
      if (m) maxN = Math.max(maxN, m[1] ? parseInt(m[1], 10) : 1);
    }
    return `${root} (${maxN + 1})`;
  }

  /**
   * Duplicate a deal document (a draft, or the archived pre-PDF source of a sent request) into a NEW
   * deal draft with a deduped name — the copy is the canvas builder state, never the flattened/signed PDF.
   */
  async duplicateDealDoc(orgId: string, userId: string, id: string) {
    const src = await this.prisma.signableDocumentTemplate.findFirst({ where: { id, orgId } }); // may be archived (a sent doc's source)
    if (!src) throw new NotFoundException('Document not found');
    if (!src.dealId) throw new BadRequestException('Only a deal document can be duplicated here.');
    const name = await this.dedupeName(orgId, src.dealId, src.name);
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        dealId: src.dealId,
        name,
        mode: src.mode,
        parties: src.parties,
        party2Source: src.party2Source,
        party2UserId: src.party2UserId,
        initialsRule: src.initialsRule,
        initialsPages: src.initialsPages as object,
        initialsParty: src.initialsParty,
        bodyHtml: src.bodyHtml,
        layout: src.layout as object,
        theme: src.theme as object,
        fileKey: src.fileKey,
        fields: src.fields as object,
      },
    });
    return shape(row);
  }

  /** Copy a template into a new "(copy)" — same content, parties, fields and options. */
  async duplicate(orgId: string, userId: string, id: string) {
    const src = await this.get(orgId, id);
    const row = await this.prisma.signableDocumentTemplate.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: `${src.name} (copy)`,
        mode: src.mode,
        parties: src.parties,
        party2Source: src.party2Source,
        party2UserId: src.party2UserId,
        initialsRule: src.initialsRule,
        initialsPages: src.initialsPages as object,
        initialsParty: src.initialsParty,
        bodyHtml: src.bodyHtml,
        layout: src.layout as object,
        theme: src.theme as object,
        fileKey: src.fileKey,
        fields: src.fields as object,
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string, role?: string) {
    const row = await this.get(orgId, id);
    // Deleting a deal's draft document is a privileged action — only an Admin may do it.
    if (row.dealId && role !== 'Admin') throw new ForbiddenException('Only an admin can delete a draft document.');
    await this.prisma.signableDocumentTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}

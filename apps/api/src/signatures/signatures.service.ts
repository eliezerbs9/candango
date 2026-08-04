import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../uploads/spaces.service';
import { type DocusealField } from './docuseal.service';
import { DocumensoService } from './documenso.service';
import { ACCEPTANCE_FIELDS, INITIALS_ZONE, PDFDocument, addAcceptancePage } from './acceptance-page';
import { CreateSignatureDto } from './dto/signature.dto';
import type { DrawnFieldDto } from './dto/signature-template.dto';
import { GenerateSignatureDto } from './dto/signable-document.dto';
import { buildTemplateContext, renderTemplate } from '../email-templates/template-vars';

/** Resolve an initials rule + page list to concrete 1-indexed content pages (clamped to the doc). */
function resolveInitialsPages(rule: string, pages: number[], pageCount: number): number[] {
  if (rule === 'every_page') return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (rule === 'last_page') return [pageCount];
  if (rule === 'specified_pages') return [...new Set(pages)].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return [];
}

/** Turn visually-placed fields into DocuSeal fields with unique names. */
function drawnToDocusealFields(drawn: DrawnFieldDto[]): DocusealField[] {
  return drawn.map((f, i) => ({
    name: f.label?.trim() || `${f.type[0].toUpperCase()}${f.type.slice(1)} ${i + 1}`,
    type: f.type,
    role: 'Client',
    areas: [{ page: f.page, x: f.x, y: f.y, w: f.w, h: f.h }],
  }));
}

const shape = (r: {
  id: string;
  dealId: string;
  title: string;
  status: string;
  signerName: string | null;
  signerEmail: string | null;
  signedFileKey: string | null;
  auditUrl: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  dealId: r.dealId,
  title: r.title,
  status: r.status,
  signerName: r.signerName,
  signerEmail: r.signerEmail,
  hasSigned: !!r.signedFileKey,
  auditUrl: r.auditUrl,
  sentAt: r.sentAt?.toISOString() ?? null,
  viewedAt: r.viewedAt?.toISOString() ?? null,
  signedAt: r.signedAt?.toISOString() ?? null,
  declinedAt: r.declinedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

@Injectable()
export class SignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly documenso: DocumensoService,
    private readonly events: EventEmitter2,
  ) {}

  async list(orgId: string, dealId: string) {
    const rows = await this.prisma.signatureRequest.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.signatureRequest.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Signature request not found');
    return row;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.signatureRequest.delete({ where: { id } });
  }

  /** Append an acceptance page to the source document and send it for signature via Documenso. */
  async create(orgId: string, userId: string, dto: CreateSignatureDto) {
    if (!this.spaces.configured) throw new ServiceUnavailableException('File storage is not configured.');
    if (!this.documenso.configured) throw new ServiceUnavailableException('E-signature is not configured (set DOCUMENSO_URL, DOCUMENSO_API_KEY).');
    if (!dto.fileKey.startsWith(`org-${orgId}/`)) throw new BadRequestException('Not your file');

    // Resolve the signing rules — from a saved SignatureTemplate, else from the inline flags.
    const template = dto.signatureTemplateId
      ? await this.prisma.signatureTemplate.findFirst({ where: { id: dto.signatureTemplateId, orgId, archivedAt: null } })
      : null;
    if (dto.signatureTemplateId && !template) throw new BadRequestException('Signature template not found');

    const acceptance = template ? template.acceptance : dto.acceptance ?? true;
    const initialsRule = template ? template.initialsRule : dto.initialsEveryPage ? 'every_page' : 'none';
    const initialsPageList = template ? ((template.initialsPages as number[] | null) ?? []) : [];
    const acceptanceText = template?.acceptanceText ?? null;
    // Drawn fields: from the template plus any placed ad-hoc on this request.
    const drawn = [...((template?.fields as DrawnFieldDto[] | null) ?? []), ...(dto.drawnFields ?? [])];

    const source = await this.spaces.getBytes(dto.fileKey);
    let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
    try {
      doc = await PDFDocument.load(source);
    } catch {
      throw new BadRequestException('Only PDF documents can be sent for signature.');
    }
    const contentPages = doc.getPageCount(); // page count of the original doc (before any appended page)
    const initialsPages = resolveInitialsPages(initialsRule, initialsPageList, contentPages);

    if (!acceptance && initialsPages.length === 0 && drawn.length === 0) {
      throw new BadRequestException('Select at least one signing option.');
    }

    const fields: DocusealField[] = [...drawnToDocusealFields(drawn)];
    if (acceptance) {
      const body = acceptanceText ? renderTemplate(acceptanceText, await this.dealContext(orgId, userId, dto.dealId)) : undefined;
      const signPage = await addAcceptancePage(doc, { title: dto.title, body });
      fields.push(
        { name: 'Signature', type: 'signature', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.signature }] },
        { name: 'Date', type: 'date', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.date }] },
        { name: 'Printed name', type: 'text', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.name }] },
      );
    }
    if (initialsPages.length > 0) {
      // One field repeated on the target pages: the signer draws initials once and they stamp all pages.
      fields.push({ name: 'Initials', type: 'initials', role: 'Client', areas: initialsPages.map((page) => ({ page, ...INITIALS_ZONE })) });
    }

    const pdf = Buffer.from(await doc.save());

    const sub = await this.documenso.createPdfSubmission({
      name: dto.title,
      fileBytes: pdf,
      fields,
      signer: { email: dto.signerEmail, name: dto.signerName },
      sendEmail: dto.sendEmail ?? true,
    });

    const row = await this.prisma.signatureRequest.create({
      data: {
        orgId,
        dealId: dto.dealId,
        title: dto.title,
        status: 'sent',
        signatureTemplateId: template?.id ?? null,
        drawnFields: (dto.drawnFields ?? []) as object,
        signerName: dto.signerName ?? null,
        signerEmail: dto.signerEmail,
        sourceFileKey: dto.fileKey,
        documensoDocumentId: sub.documentId,
        createdByUserId: userId,
        sentAt: new Date(),
      },
    });
    return { ...shape(row), signingUrl: sub.signingUrl };
  }

  /** Generate a document from a SignableDocumentTemplate and send it for signature. */
  async createGenerated(orgId: string, userId: string, dto: GenerateSignatureDto) {
    if (!this.documenso.configured) throw new ServiceUnavailableException('E-signature is not configured (set DOCUMENSO_URL, DOCUMENSO_API_KEY).');
    const tpl = await this.prisma.signableDocumentTemplate.findFirst({ where: { id: dto.signableDocumentTemplateId, orgId, archivedAt: null } });
    if (!tpl) throw new BadRequestException('Document template not found');

    // builder / raw-HTML templates render to HTML; the new engine (Documenso) signs PDFs — the
    // HTML→PDF step lands in a later phase. Upload-mode (a template-owned PDF) works today.
    if (tpl.mode !== 'upload') {
      throw new BadRequestException('Generated (visual builder / HTML) documents aren’t available yet with the new signing engine — use an Upload-PDF document template for now.');
    }
    if (!tpl.fileKey || !tpl.fileKey.startsWith(`org-${orgId}/`)) throw new BadRequestException('This template has no source document');

    const ctx = await this.dealContext(orgId, userId, dto.dealId);
    const signerEmail = (dto.signerEmail || ctx['contact.email'] || '').trim();
    if (!signerEmail) throw new BadRequestException('No signer email — set a primary contact with an email on the deal.');
    const signerName = (dto.signerName || ctx['contact.name'] || '').trim() || undefined;

    const source = await this.spaces.getBytes(tpl.fileKey);
    let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
    try {
      doc = await PDFDocument.load(source);
    } catch {
      throw new BadRequestException('The template document must be a PDF.');
    }
    const fields: DocusealField[] = drawnToDocusealFields((tpl.fields as DrawnFieldDto[] | null) ?? []);
    if (fields.length === 0) {
      const signPage = await addAcceptancePage(doc, { title: tpl.name });
      fields.push(
        { name: 'Signature', type: 'signature', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.signature }] },
        { name: 'Date', type: 'date', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.date }] },
        { name: 'Printed name', type: 'text', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.name }] },
      );
    }
    const pdf = Buffer.from(await doc.save());
    const sub = await this.documenso.createPdfSubmission({ name: tpl.name, fileBytes: pdf, fields, signer: { email: signerEmail, name: signerName }, sendEmail: dto.sendEmail ?? true });

    const row = await this.prisma.signatureRequest.create({
      data: {
        orgId,
        dealId: dto.dealId,
        title: tpl.name,
        status: 'sent',
        signerName: signerName ?? null,
        signerEmail,
        sourceFileKey: tpl.fileKey,
        documensoDocumentId: sub.documentId,
        createdByUserId: userId,
        sentAt: new Date(),
      },
    });
    return { ...shape(row), signingUrl: sub.signingUrl };
  }

  /** Build the {{variable}} context for a deal (contact/company/deal + sender + workspace). */
  private async dealContext(orgId: string, userId: string, dealId: string): Promise<Record<string, string>> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: {
        title: true,
        value: true,
        currency: true,
        primaryPerson: { select: { firstName: true, lastName: true, name: true, emails: true, phones: true } },
        company: { select: { name: true } },
      },
    });
    const [user, org] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, orgId }, select: { name: true, email: true, phone: true } }),
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, timezone: true } }),
    ]);
    return buildTemplateContext({
      person: deal?.primaryPerson ?? null,
      company: deal?.company ?? null,
      deal: deal ? { title: deal.title, value: deal.value, currency: deal.currency } : null,
      sender: user,
      workspace: org,
    });
  }

  async signedUrl(orgId: string, id: string) {
    const row = await this.get(orgId, id);
    if (!row.signedFileKey) throw new NotFoundException('Not signed yet');
    return { url: await this.spaces.presignGet(row.signedFileKey) };
  }

  /** Documenso webhook (no tenant context — RLS bypassed, correlated by documensoDocumentId). */
  async handleWebhook(payload: unknown) {
    const p = (payload ?? {}) as { event?: string; payload?: Record<string, unknown> };
    const data = p.payload ?? {};
    const nested = (data.document as Record<string, unknown> | undefined) ?? {};
    const docId = Number(data.documentId ?? data.id ?? nested.id ?? 0);
    if (!docId) return;
    const row = await this.prisma.signatureRequest.findFirst({ where: { documensoDocumentId: docId } });
    if (!row) return;

    const event = p.event ?? '';
    if (event === 'DOCUMENT_COMPLETED') {
      let signedFileKey = row.signedFileKey;
      if (this.documenso.configured && this.spaces.configured) {
        try {
          const bytes = await this.documenso.downloadSignedPdf(docId);
          signedFileKey = `org-${row.orgId}/signature/${row.id}-signed.pdf`;
          await this.spaces.putBytes(signedFileKey, bytes, 'application/pdf');
        } catch {
          /* couldn't pull the PDF now — still mark signed; a manual re-fetch can recover it */
        }
      }
      await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: 'signed', signedAt: new Date(), signedFileKey } });
      const author = row.createdByUserId ?? (await this.prisma.deal.findFirst({ where: { id: row.dealId }, select: { ownerUserId: true } }))?.ownerUserId;
      if (author) {
        await this.prisma.note.create({
          data: { orgId: row.orgId, dealId: row.dealId, authorUserId: author, body: `“${row.title}” was signed by ${row.signerName || row.signerEmail || 'the customer'}.` },
        });
      }
      this.events.emit('webhook.event', { orgId: row.orgId, type: 'document.signed', data: { deal: { id: row.dealId }, signature: { id: row.id } } });
    } else if (event === 'DOCUMENT_OPENED') {
      if (!row.viewedAt) {
        await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: row.status === 'sent' ? 'viewed' : row.status, viewedAt: new Date() } });
      }
    } else if (event === 'DOCUMENT_REJECTED' || event === 'DOCUMENT_CANCELLED') {
      await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: 'declined', declinedAt: new Date() } });
    }
  }
}

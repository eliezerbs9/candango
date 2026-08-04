import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../uploads/spaces.service';
import { DocusealService, type DocusealField } from './docuseal.service';
import { ACCEPTANCE_FIELDS, appendAcceptancePage } from './acceptance-page';
import { CreateSignatureDto } from './dto/signature.dto';

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
    private readonly docuseal: DocusealService,
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

  /** Append an acceptance page to the source document and send it for signature via DocuSeal. */
  async create(orgId: string, userId: string, dto: CreateSignatureDto) {
    if (!this.spaces.configured) throw new ServiceUnavailableException('File storage is not configured.');
    if (!this.docuseal.configured) throw new ServiceUnavailableException('E-signature is not configured (set DOCUSEAL_URL, DOCUSEAL_API_KEY).');
    if (!dto.fileKey.startsWith(`org-${orgId}/`)) throw new BadRequestException('Not your file');

    const source = await this.spaces.getBytes(dto.fileKey);
    const { pdf, signPage } = await appendAcceptancePage(source, { title: dto.title });

    const fields: DocusealField[] = [
      { name: 'Signature', type: 'signature', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.signature }] },
      { name: 'Date', type: 'date', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.date }] },
      { name: 'Printed name', type: 'text', role: 'Client', areas: [{ page: signPage, ...ACCEPTANCE_FIELDS.name }] },
    ];

    const sub = await this.docuseal.createPdfSubmission({
      name: dto.title,
      fileName: `${dto.title}.pdf`,
      fileBase64: pdf.toString('base64'),
      fields,
      submitter: { role: 'Client', email: dto.signerEmail, name: dto.signerName },
      sendEmail: dto.sendEmail ?? true,
    });

    const row = await this.prisma.signatureRequest.create({
      data: {
        orgId,
        dealId: dto.dealId,
        title: dto.title,
        status: 'sent',
        signerName: dto.signerName ?? null,
        signerEmail: dto.signerEmail,
        sourceFileKey: dto.fileKey,
        docusealSubmissionId: sub.submissionId || null,
        createdByUserId: userId,
        sentAt: new Date(),
      },
    });
    return { ...shape(row), signingUrl: sub.signingUrl };
  }

  async signedUrl(orgId: string, id: string) {
    const row = await this.get(orgId, id);
    if (!row.signedFileKey) throw new NotFoundException('Not signed yet');
    return { url: await this.spaces.presignGet(row.signedFileKey) };
  }

  /** DocuSeal webhook (no tenant context — RLS bypassed, correlated by docusealSubmissionId). */
  async handleWebhook(payload: unknown) {
    const p = (payload ?? {}) as { event_type?: string; submission?: Record<string, unknown> };
    const submission = p.submission ?? {};
    const subId = submission.id ? String(submission.id) : null;
    if (!subId) return;
    const row = await this.prisma.signatureRequest.findFirst({ where: { docusealSubmissionId: subId } });
    if (!row) return;

    const type = p.event_type ?? '';
    if (type === 'submission_completed' || submission.status === 'completed') {
      const documents = (submission.documents as { url?: string }[] | undefined) ?? [];
      let signedFileKey = row.signedFileKey;
      const docUrl = documents[0]?.url;
      if (docUrl && this.spaces.configured) {
        const bytes = await this.docuseal.downloadFile(docUrl);
        signedFileKey = `org-${row.orgId}/signature/${row.id}-signed.pdf`;
        await this.spaces.putBytes(signedFileKey, bytes, 'application/pdf');
      }
      await this.prisma.signatureRequest.update({
        where: { id: row.id },
        data: { status: 'signed', signedAt: new Date(), signedFileKey, auditUrl: (submission.audit_log_url as string) ?? null },
      });
      const author = row.createdByUserId ?? (await this.prisma.deal.findFirst({ where: { id: row.dealId }, select: { ownerUserId: true } }))?.ownerUserId;
      if (author) {
        await this.prisma.note.create({
          data: { orgId: row.orgId, dealId: row.dealId, authorUserId: author, body: `“${row.title}” was signed by ${row.signerName || row.signerEmail || 'the customer'}.` },
        });
      }
      this.events.emit('webhook.event', { orgId: row.orgId, type: 'document.signed', data: { deal: { id: row.dealId }, signature: { id: row.id } } });
    } else if (type === 'submission_viewed' || submission.status === 'opened') {
      if (!row.viewedAt) {
        await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: row.status === 'sent' ? 'viewed' : row.status, viewedAt: new Date() } });
      }
    } else if (type === 'submission_declined' || type === 'submission_expired') {
      await this.prisma.signatureRequest.update({
        where: { id: row.id },
        data: { status: type === 'submission_declined' ? 'declined' : 'expired', declinedAt: new Date() },
      });
    }
  }
}

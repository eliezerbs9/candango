import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocusealField } from './docuseal.service';

/** Map our neutral field types (shared with the acceptance-page + drawn fields) to Documenso's. */
const FIELD_TYPE: Record<string, string> = {
  signature: 'SIGNATURE',
  initials: 'INITIALS',
  date: 'DATE',
  text: 'TEXT',
  checkbox: 'CHECKBOX',
  name: 'NAME', // auto-fills the recipient's name
};

/**
 * Thin client for a self-hosted Documenso instance (REST API v1). Inert until configured — set
 * DOCUMENSO_URL and DOCUMENSO_API_KEY. Unlike DocuSeal CE, Documenso's self-hosted API is free +
 * unlimited. See 06 - Delivery/E-Signature — Documenso Migration Plan.
 */
@Injectable()
export class DocumensoService {
  private readonly url: string;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('DOCUMENSO_URL') ?? '').replace(/\/+$/, '');
    this.key = config.get<string>('DOCUMENSO_API_KEY') ?? '';
  }

  get configured() {
    return !!this.url && !!this.key;
  }

  private async req(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    if (!this.configured) throw new ServiceUnavailableException('E-signature is not configured (set DOCUMENSO_URL, DOCUMENSO_API_KEY).');
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: { Authorization: this.key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`Documenso ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Create a document from a PDF, add the recipient(s), place their fields, and send it. Multi-step:
   * create → upload the PDF to the presigned URL → add fields → send. Recipients sign in order
   * (index 0 first). Fields carry a `recipient` index. Returns the document id + the first signer's
   * link.
   */
  async createPdfSubmission(input: {
    name: string;
    fileBytes: Buffer;
    fields: DocusealField[];
    recipients: { email: string; name?: string }[];
    sendEmail: boolean;
  }): Promise<{ documentId: number; signingUrl?: string; recipients: { email: string; name: string; signingUrl?: string }[] }> {
    if (input.recipients.length === 0) throw new BadRequestException('At least one signer is required');
    // No signingOrder → parties can sign in parallel (any order).
    const created = await this.req('POST', '/api/v1/documents', {
      title: input.name,
      recipients: input.recipients.map((r) => ({ name: r.name || r.email, email: r.email, role: 'SIGNER' })),
      meta: {},
    });
    const documentId = Number(created.documentId ?? created.id);
    const uploadUrl = String(created.uploadUrl ?? '');
    const created_recipients = (created.recipients as Record<string, unknown>[] | undefined) ?? [];
    // Documenso may return recipients in a different order — match back to our input by email so
    // field.recipient (an index into OUR ordered recipients) lands on the correct signer.
    const byEmail = new Map(created_recipients.map((r) => [String(r.email ?? '').toLowerCase(), r]));
    const ordered = input.recipients.map((r) => byEmail.get(r.email.toLowerCase()) ?? {});
    const recipientIds = ordered.map((r) => Number(r.recipientId ?? r.id));
    const outRecipients = ordered.map((r, i) => ({ email: input.recipients[i].email, name: String(r.name ?? input.recipients[i].name ?? ''), signingUrl: r.signingUrl as string | undefined }));
    const signingUrl = outRecipients[0]?.signingUrl;
    if (!documentId || !uploadUrl || recipientIds.some((n) => !n)) throw new BadRequestException('Documenso create returned an unexpected shape');

    // Upload the PDF bytes straight to the presigned (S3) URL.
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: new Uint8Array(input.fileBytes) });
    if (!put.ok) throw new BadRequestException(`Documenso upload failed: ${put.status}`);

    // Each field area becomes one Documenso field for its recipient (normalized 0–1 top-left → percent).
    for (const f of input.fields) {
      const recipientId = recipientIds[f.recipient ?? 0] ?? recipientIds[0];
      const type = FIELD_TYPE[f.type] ?? 'SIGNATURE';
      // Documenso requires a fieldMeta for TEXT fields (a bare TEXT field 500s).
      const fieldMeta = type === 'TEXT' ? { type: 'text', label: f.name } : undefined;
      for (const a of f.areas) {
        await this.req('POST', `/api/v1/documents/${documentId}/fields`, {
          recipientId,
          type,
          pageNumber: a.page,
          pageX: a.x * 100,
          pageY: a.y * 100,
          pageWidth: a.w * 100,
          pageHeight: a.h * 100,
          ...(fieldMeta ? { fieldMeta } : {}),
        });
      }
    }

    await this.req('POST', `/api/v1/documents/${documentId}/send`, { sendEmail: input.sendEmail });
    return { documentId, signingUrl, recipients: outRecipients };
  }

  /** Current document status (DRAFT | PENDING | COMPLETED | REJECTED …) for reconciliation. */
  async getDocumentStatus(documentId: number): Promise<string | null> {
    try {
      const doc = await this.req('GET', `/api/v1/documents/${documentId}`);
      return (doc.status as string) ?? null;
    } catch {
      return null;
    }
  }

  /** Re-send the signing request emails for a pending document. */
  async resend(documentId: number): Promise<void> {
    await this.req('POST', `/api/v1/documents/${documentId}/resend`, { recipients: [] });
  }

  /** Delete/void a document. */
  async deleteDocument(documentId: number): Promise<void> {
    await this.req('DELETE', `/api/v1/documents/${documentId}`);
  }

  /** Pull the completed/signed PDF (S3 transport) — a presigned download URL, then the bytes. */
  async downloadSignedPdf(documentId: number): Promise<Buffer> {
    const dl = await this.req('GET', `/api/v1/documents/${documentId}/download`);
    const downloadUrl = String(dl.downloadUrl ?? '');
    if (!downloadUrl) throw new BadRequestException('Documenso download returned no URL');
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Documenso download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

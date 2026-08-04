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
   * Create a document from a PDF, place fields for a single signer, and send it. Multi-step:
   * create → upload the PDF to the presigned URL → add fields → send. Returns the document id +
   * the signer's link. (Phase A: single signer; multi-recipient comes in Phase B.)
   */
  async createPdfSubmission(input: {
    name: string;
    fileBytes: Buffer;
    fields: DocusealField[];
    signer: { email: string; name?: string };
    sendEmail: boolean;
  }): Promise<{ documentId: number; signingUrl?: string }> {
    const created = await this.req('POST', '/api/v1/documents', {
      title: input.name,
      recipients: [{ name: input.signer.name || input.signer.email, email: input.signer.email, role: 'SIGNER' }],
      meta: {},
    });
    const documentId = Number(created.documentId ?? created.id);
    const uploadUrl = String(created.uploadUrl ?? '');
    const recipients = (created.recipients as Record<string, unknown>[] | undefined) ?? [];
    const recipientId = Number(recipients[0]?.recipientId ?? recipients[0]?.id);
    const signingUrl = recipients[0]?.signingUrl as string | undefined;
    if (!documentId || !uploadUrl || !recipientId) throw new BadRequestException('Documenso create returned an unexpected shape');

    // Upload the PDF bytes straight to the presigned (S3) URL.
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: new Uint8Array(input.fileBytes) });
    if (!put.ok) throw new BadRequestException(`Documenso upload failed: ${put.status}`);

    // Each field area becomes one Documenso field (normalized 0–1 top-left → percent).
    for (const f of input.fields) {
      for (const a of f.areas) {
        await this.req('POST', `/api/v1/documents/${documentId}/fields`, {
          recipientId,
          type: FIELD_TYPE[f.type] ?? 'SIGNATURE',
          pageNumber: a.page,
          pageX: a.x * 100,
          pageY: a.y * 100,
          pageWidth: a.w * 100,
          pageHeight: a.h * 100,
        });
      }
    }

    await this.req('POST', `/api/v1/documents/${documentId}/send`, { sendEmail: input.sendEmail });
    return { documentId, signingUrl };
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

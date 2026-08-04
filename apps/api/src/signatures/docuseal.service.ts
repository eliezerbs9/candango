import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** A signing field placed on a document. `areas` use normalized (0–1) page coordinates, page 1-indexed. */
export interface DocusealField {
  name: string;
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name';
  role: string;
  /** Index into the submission's recipients (0 = first signer). Defaults to 0. */
  recipient?: number;
  areas: { page: number; x: number; y: number; w: number; h: number }[];
}

/**
 * Thin client for a self-hosted DocuSeal instance (REST API). Inert until configured — set
 * DOCUSEAL_URL and DOCUSEAL_API_KEY. See 06 - Delivery/E-Signature — Design & Plan.
 */
@Injectable()
export class DocusealService {
  private readonly url: string;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('DOCUSEAL_URL') ?? '').replace(/\/+$/, '');
    this.key = config.get<string>('DOCUSEAL_API_KEY') ?? '';
  }

  get configured() {
    return !!this.url && !!this.key;
  }

  private async req(method: string, path: string, body?: unknown): Promise<unknown> {
    if (!this.configured) throw new ServiceUnavailableException('E-signature is not configured (set DOCUSEAL_URL, DOCUSEAL_API_KEY).');
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: { 'X-Auth-Token': this.key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`DocuSeal ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  /** One-off submission from an uploaded PDF with inline field placement; returns the signer's link. */
  async createPdfSubmission(input: {
    name: string;
    fileName: string;
    fileBase64: string;
    fields: DocusealField[];
    submitter: { role: string; email: string; name?: string };
    sendEmail: boolean;
  }): Promise<{ submissionId: string; signingUrl?: string }> {
    const res = await this.req('POST', '/submissions/pdf', {
      name: input.name,
      send_email: input.sendEmail,
      documents: [{ name: input.fileName, file: input.fileBase64, fields: input.fields }],
      submitters: [{ role: input.submitter.role, email: input.submitter.email, name: input.submitter.name }],
    });
    return this.parseSubmission(res);
  }

  /**
   * One-off submission from generated HTML — fields are defined by inline field tags in the markup
   * (`<signature-field>`, `<date-field>`, `{{Field;type=signature}}`), so they flow with the content.
   * Used for generated agreements (Class A). Returns the signer's link.
   */
  async createHtmlSubmission(input: {
    name: string;
    html: string;
    submitter: { role: string; email: string; name?: string };
    sendEmail: boolean;
    /** DocuSeal page size for the generated PDF, e.g. 'Letter' | 'A4'. */
    size?: string;
  }): Promise<{ submissionId: string; signingUrl?: string }> {
    const res = await this.req('POST', '/submissions/html', {
      name: input.name,
      send_email: input.sendEmail,
      documents: [{ name: input.name, html: input.html, ...(input.size ? { size: input.size } : {}) }],
      submitters: [{ role: input.submitter.role, email: input.submitter.email, name: input.submitter.name }],
    });
    return this.parseSubmission(res);
  }

  /** DocuSeal returns either a submission object {id, submitters:[...]} or a bare array of submitters. */
  private parseSubmission(res: unknown): { submissionId: string; signingUrl?: string } {
    const r = res as Record<string, unknown> | Record<string, unknown>[];
    const submitters = (Array.isArray(r) ? r : ((r.submitters as Record<string, unknown>[]) ?? [])) as Record<string, unknown>[];
    const first = submitters[0] ?? {};
    const submissionId = String((Array.isArray(r) ? first.submission_id : (r as Record<string, unknown>).id) ?? first.submission_id ?? '');
    const slug = first.slug as string | undefined;
    const signingUrl = (first.embed_src as string | undefined) ?? (slug ? `${this.url}/s/${slug}` : undefined);
    return { submissionId, signingUrl };
  }

  /** Download a completed document / audit PDF from DocuSeal. */
  async downloadFile(url: string): Promise<Buffer> {
    const res = await fetch(url, { headers: { 'X-Auth-Token': this.key } });
    if (!res.ok) throw new Error(`DocuSeal download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

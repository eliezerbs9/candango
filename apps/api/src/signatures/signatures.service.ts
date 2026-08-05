import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../uploads/spaces.service';
import { type DocusealField } from './docuseal.service';
import { DocumensoService } from './documenso.service';
import { GotenbergService } from './gotenberg.service';
import { extractLayoutFields, layoutToHtml } from './layout-to-html';
import { initialsZones, PDFDocument, addAcceptancePage } from './acceptance-page';
import { CreateSignatureDto } from './dto/signature.dto';
import type { DrawnFieldDto } from './dto/signature-template.dto';
import { GenerateSignatureDto } from './dto/signable-document.dto';
import { MessagesService } from '../messages/messages.service';
import { buildSignatureValues, buildTemplateContext, normalizeSignature, renderSignatureHtml, renderTemplate } from '../email-templates/template-vars';

/** Resolve an initials rule + page list to concrete 1-indexed content pages (clamped to the doc). */
function resolveInitialsPages(rule: string, pages: number[], pageCount: number): number[] {
  if (rule === 'every_page') return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (rule === 'last_page') return [pageCount];
  if (rule === 'specified_pages') return [...new Set(pages)].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return [];
}

/** Which recipient indexes get the page-initials field, given the rule and the party count. */
function initialsRecipientIndexes(initialsParty: string, recipientCount: number): number[] {
  if (recipientCount <= 1) return [0]; // only the client exists
  if (initialsParty === 'sender') return [1];
  if (initialsParty === 'both') return [0, 1];
  return [0]; // client (default)
}

/** Turn visually-placed fields into DocuSeal fields with unique names (routing to each field's party). */
function drawnToDocusealFields(drawn: DrawnFieldDto[]): DocusealField[] {
  return drawn.map((f, i) => ({
    name: f.label?.trim() || `${f.type[0].toUpperCase()}${f.type.slice(1)} ${i + 1}`,
    type: f.type,
    role: 'Client',
    recipient: f.party === 'sender' ? 1 : 0,
    areas: [{ page: f.page, x: f.x, y: f.y, w: f.w, h: f.h }],
  }));
}

const shape = (r: {
  id: string;
  dealId: string;
  title: string;
  status: string;
  recipients: unknown;
  hasInitials: boolean;
  signerName: string | null;
  signerEmail: string | null;
  sourceFileKey: string | null;
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
  sourceFileKey: r.sourceFileKey,
  signedFileKey: r.signedFileKey,
  hasSigned: !!r.signedFileKey,
  hasInitials: r.hasInitials,
  // The signing parties (name + role + status) for the deal card — no links/emails leaked.
  signers: ((r.recipients as { name?: string; owner?: boolean; signed?: boolean }[] | null) ?? []).map((x) => ({
    name: x.name ?? '',
    owner: !!x.owner,
    signed: r.status === 'signed' ? true : !!x.signed,
  })),
  // The workspace's own signing link (the deal-owner party), so it can sign its part from the deal.
  ownerSignUrl:
    r.status !== 'signed'
      ? ((r.recipients as { owner?: boolean; signingUrl?: string; signed?: boolean }[] | null) ?? []).find((x) => x.owner && !x.signed)?.signingUrl ?? null
      : null,
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
    private readonly gotenberg: GotenbergService,
    private readonly messages: MessagesService,
    private readonly events: EventEmitter2,
  ) {}

  /** True when the deal owner has a connected mailbox (so Candango can send the invite itself). */
  private async ownerHasMailbox(orgId: string, ownerUserId: string | null | undefined): Promise<boolean> {
    if (!ownerUserId) return false;
    return (await this.prisma.mailboxConnection.count({ where: { orgId, userId: ownerUserId } })) > 0;
  }

  /**
   * Send the signing invite(s) from the deal owner's mailbox with the workspace signature + the
   * "Signature request" email template (Candango email). Falls back to a default body if untemplated.
   */
  private async sendInvites(orgId: string, ownerUserId: string, dealId: string, title: string, recipients: { email: string; name: string; signingUrl?: string }[]) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: { title: true, value: true, currency: true, company: { select: { name: true } } },
    });
    const [owner, org] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: ownerUserId, orgId }, select: { name: true, email: true, phone: true, avatarUrl: true } }),
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, timezone: true, logoUrl: true, emailSignature: true } }),
    ]);
    const tpl = await this.prisma.emailTemplate.findFirst({ where: { orgId, scope: 'signature', archivedAt: null }, orderBy: { createdAt: 'asc' } });
    const signatureHtml = renderSignatureHtml(
      normalizeSignature(org?.emailSignature),
      buildSignatureValues({ name: owner?.name, email: owner?.email, phone: owner?.phone, avatarUrl: owner?.avatarUrl }, { name: org?.name, logoUrl: org?.logoUrl }),
    );

    for (const r of recipients) {
      if (!r.email || !r.signingUrl) continue;
      const link = `<a href="${r.signingUrl}">Review &amp; sign</a>`;
      const ctx = buildTemplateContext({
        person: { firstName: r.name, name: r.name },
        company: deal?.company ?? null,
        deal: deal ? { title: deal.title, value: deal.value, currency: deal.currency } : null,
        sender: owner,
        workspace: org,
      });
      ctx['signature.url'] = link;
      ctx['signature.name'] = title;
      let subject = `Please sign: ${title}`;
      let body = `<p>Hi ${r.name || 'there'},</p><p>Please review and sign <strong>${title}</strong> — ${link}.</p>`;
      if (tpl) {
        subject = renderTemplate(tpl.subject, ctx) || subject;
        body = renderTemplate(tpl.body, ctx);
        if (!tpl.body.includes('signature.url')) body += `<p>${link}</p>`;
      }
      if (signatureHtml.trim()) body += signatureHtml;
      try {
        await this.messages.send(orgId, ownerUserId, { to: [r.email], subject, body, html: true, dealId });
      } catch {
        /* mailbox send failed — the link still exists on the request/Documenso */
      }
    }
  }

  async list(orgId: string, dealId: string) {
    let rows = await this.prisma.signatureRequest.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    // Self-heal: reconcile any still-pending requests against Documenso (in case a webhook was missed).
    const pending = rows.filter((r) => (r.status === 'sent' || r.status === 'viewed') && r.documensoDocumentId);
    if (pending.length && this.documenso.configured) {
      await Promise.all(pending.map((r) => this.reconcile(r).catch(() => {})));
      rows = await this.prisma.signatureRequest.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    }
    return rows.map(shape);
  }

  /** Poll Documenso for a pending request: sync per-recipient signed state + the completed/declined outcome. */
  private async reconcile(row: { id: string; orgId: string; dealId: string; title: string; recipients: unknown; signerName: string | null; signerEmail: string | null; createdByUserId: string | null; signedFileKey: string | null; documensoDocumentId: number | null }) {
    if (!row.documensoDocumentId) return;
    const doc = await this.documenso.getDocument(row.documensoDocumentId);
    // Update each stored recipient's signed flag (match by email).
    const stored = (row.recipients as { email?: string }[] | null) ?? [];
    if (stored.length && doc.recipients.length) {
      const signedByEmail = new Map(doc.recipients.map((r) => [r.email, r.signed]));
      const updated = stored.map((r) => ({ ...r, signed: signedByEmail.get(String(r.email ?? '').toLowerCase()) ?? (r as { signed?: boolean }).signed ?? false }));
      await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { recipients: updated as object } });
    }
    if (doc.status === 'COMPLETED') await this.markSigned(row);
    else if (doc.status === 'REJECTED' || doc.status === 'CANCELLED') {
      await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: 'declined', declinedAt: new Date() } });
    }
  }

  /** Pull the signed PDF into Spaces, mark signed, log a deal note, and emit document.signed. */
  private async markSigned(row: { id: string; orgId: string; dealId: string; title: string; signerName: string | null; signerEmail: string | null; createdByUserId: string | null; signedFileKey: string | null; documensoDocumentId: number | null }) {
    let signedFileKey = row.signedFileKey;
    if (row.documensoDocumentId && this.documenso.configured && this.spaces.configured) {
      try {
        const bytes = await this.documenso.downloadSignedPdf(row.documensoDocumentId);
        signedFileKey = `org-${row.orgId}/signature/${row.id}-signed.pdf`;
        await this.spaces.putBytes(signedFileKey, bytes, 'application/pdf');
      } catch {
        /* couldn't pull the PDF now — still mark signed; a later reconcile can recover it */
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
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.signatureRequest.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Signature request not found');
    return row;
  }

  async remove(orgId: string, id: string) {
    const row = await this.get(orgId, id);
    // Best-effort: void the Documenso document so it isn't left orphaned/signable.
    if (row.documensoDocumentId && this.documenso.configured) {
      await this.documenso.deleteDocument(row.documensoDocumentId).catch(() => {});
    }
    await this.prisma.signatureRequest.delete({ where: { id } });
  }

  /** Re-send the signing invitation email(s) for a pending request. */
  async resend(orgId: string, id: string) {
    const row = await this.get(orgId, id);
    if (row.status === 'signed' || row.status === 'declined') throw new BadRequestException('This request is already finished.');
    if (!row.documensoDocumentId) throw new BadRequestException('Nothing to resend.');
    await this.documenso.resend(row.documensoDocumentId);
    return { ok: true };
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
    const initialsParty = template?.initialsParty ?? 'client';
    const acceptanceText = template?.acceptanceText ?? null;
    // Parties + who signs the 2nd party — from the template, else the inline "both parties" flag.
    const partiesBoth = template ? template.parties === 'both' : dto.bothParties ?? false;
    const party2 = { enabled: partiesBoth, source: (template?.party2Source as 'owner' | 'user') ?? 'owner', userId: template?.party2UserId ?? null };
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

    // Recipients: the client, plus (optionally) a second party (deal owner or a fixed user) as a counter-signer.
    const recipients = await this.resolveRecipients(orgId, dto.dealId, { email: dto.signerEmail, name: dto.signerName }, party2);

    const fields: DocusealField[] = [...drawnToDocusealFields(drawn)];
    if (acceptance) {
      const body = acceptanceText ? renderTemplate(acceptanceText, await this.dealContext(orgId, userId, dto.dealId)) : undefined;
      const labels = await this.partyBlockLabels(orgId, dto.dealId);
      const clientLabel = dto.clientPartyLabel?.trim() || labels.client;
      const parties = recipients.map((r, i) => ({ label: i === 0 ? clientLabel : labels.workspace, recipient: i }));
      fields.push(...(await addAcceptancePage(doc, { title: dto.title, body, parties })));
    }
    if (initialsPages.length > 0) {
      // Repeat a footer initials field on the target pages, for each party that initials (offset side-by-side).
      const targets = initialsRecipientIndexes(initialsParty, recipients.length);
      const zones = initialsZones(targets.length);
      targets.forEach((rIdx, k) => {
        fields.push({ name: `Initials ${rIdx + 1}`, type: 'initials', role: 'Client', recipient: rIdx, areas: initialsPages.map((page) => ({ page, ...zones[k] })) });
      });
    }
    // Documenso rejects any signer with no SIGNATURE field — append an acceptance block for any missing
    // (covers manually-placed fields that only signed one party).
    const missingSig = recipients.map((_, i) => i).filter((i) => !fields.some((f) => (f.recipient ?? 0) === i && f.type === 'signature'));
    if (missingSig.length) {
      const labels = await this.partyBlockLabels(orgId, dto.dealId);
      const clientLabel = dto.clientPartyLabel?.trim() || labels.client;
      const parties = missingSig.map((i) => ({ label: i === 0 ? clientLabel : labels.workspace, recipient: i }));
      fields.push(...(await addAcceptancePage(doc, { title: dto.title, parties })));
    }

    const pdf = Buffer.from(await doc.save());

    // Email from Candango (owner's mailbox + template) when a mailbox is connected; else Documenso sends.
    const ownerUserId = (await this.prisma.deal.findFirst({ where: { id: dto.dealId, orgId }, select: { ownerUserId: true } }))?.ownerUserId ?? null;
    const wantEmail = dto.sendEmail ?? true;
    const candangoEmail = wantEmail && (await this.ownerHasMailbox(orgId, ownerUserId));

    const sub = await this.documenso.createPdfSubmission({
      name: dto.title,
      fileBytes: pdf,
      fields,
      recipients,
      sendEmail: wantEmail && !candangoEmail,
    });
    if (candangoEmail && ownerUserId) await this.sendInvites(orgId, ownerUserId, dto.dealId, dto.title, sub.recipients);

    const row = await this.prisma.signatureRequest.create({
      data: {
        orgId,
        dealId: dto.dealId,
        title: dto.title,
        status: 'sent',
        signatureTemplateId: template?.id ?? null,
        drawnFields: (dto.drawnFields ?? []) as object,
        recipients: this.mergeRecipients(recipients, sub.recipients) as object,
        hasInitials: initialsPages.length > 0 || drawn.some((f) => f.type === 'initials'),
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

    const ctx = await this.dealContext(orgId, userId, dto.dealId);
    const signerEmail = (dto.signerEmail || ctx['contact.email'] || '').trim();
    if (!signerEmail) throw new BadRequestException('No signer email — set a primary contact with an email on the deal.');
    const signerName = (dto.signerName || ctx['contact.name'] || '').trim() || undefined;
    // The template decides who signs (one party or both); builder "sender" fields only bind when both.
    const layoutFields = tpl.mode === 'builder' ? extractLayoutFields(tpl.layout) : [];
    const partiesBoth = dto.bothParties ?? tpl.parties === 'both';
    const party2 = { enabled: partiesBoth, source: (tpl.party2Source as 'owner' | 'user') ?? 'owner', userId: tpl.party2UserId ?? null };

    // Build the source PDF for the template's mode (upload = stored PDF; builder/html = HTML→PDF per deal).
    let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
    if (tpl.mode === 'upload') {
      if (!tpl.fileKey || !tpl.fileKey.startsWith(`org-${orgId}/`)) throw new BadRequestException('This template has no source document');
      try {
        doc = await PDFDocument.load(await this.spaces.getBytes(tpl.fileKey));
      } catch {
        throw new BadRequestException('The template document must be a PDF.');
      }
    } else {
      if (!this.gotenberg.configured) throw new ServiceUnavailableException('Document generation is not configured (set GOTENBERG_URL).');
      const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { logoUrl: true } });
      const theme = tpl.theme as { accentColor?: string; fontHeading?: string; fontBody?: string; orientation?: string; paperSize?: string } | null;
      const html =
        tpl.mode === 'builder'
          ? layoutToHtml(tpl.layout, theme, ctx, org?.logoUrl ?? null)
          : `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.6;padding:48px">${renderTemplate(tpl.bodyHtml || '', ctx)}</body></html>`;
      doc = await PDFDocument.load(await this.gotenberg.htmlToPdf(html, { paperSize: theme?.paperSize, orientation: theme?.orientation }));
    }

    const contentPages = doc.getPageCount(); // before any appended acceptance page
    const recipients = await this.resolveRecipients(orgId, dto.dealId, { email: signerEmail, name: signerName }, party2);

    // Signing fields by mode: upload = drawn on the PDF; builder = placed on the canvas (mapped by %);
    // html = none up front (the acceptance page + initials rule cover it).
    const fields: DocusealField[] = [];
    if (tpl.mode === 'upload') {
      fields.push(...drawnToDocusealFields((tpl.fields as DrawnFieldDto[] | null) ?? []));
    } else if (tpl.mode === 'builder') {
      fields.push(
        ...layoutFields.map((f, i) => ({
          name: `${f.fieldType[0].toUpperCase()}${f.fieldType.slice(1)} ${i + 1}`,
          type: (['signature', 'initials', 'date', 'text'].includes(f.fieldType) ? f.fieldType : 'signature') as DocusealField['type'],
          role: 'Client',
          recipient: f.party === 'sender' && partiesBoth ? 1 : 0,
          areas: [{ page: f.page, x: f.x / 100, y: f.y / 100, w: f.w / 100, h: f.h / 100 }],
        })),
      );
    }
    // Documenso rejects any signer with no SIGNATURE field. Append an acceptance-page block for every
    // party that lacks one — covers raw-HTML docs (no placed fields) and both-parties templates whose
    // builder/upload layout only signed one side.
    const missing = recipients.map((_, i) => i).filter((i) => !fields.some((f) => (f.recipient ?? 0) === i && f.type === 'signature'));
    if (missing.length) {
      const labels = await this.partyBlockLabels(orgId, dto.dealId);
      const clientLabel = dto.clientPartyLabel?.trim() || labels.client;
      const parties = missing.map((i) => ({ label: i === 0 ? clientLabel : labels.workspace, recipient: i }));
      fields.push(...(await addAcceptancePage(doc, { title: tpl.name, parties })));
    }
    // Footer initials rule — only for raw-HTML docs (builder places initials on the canvas; upload draws them).
    if (tpl.mode === 'html' && (tpl.initialsRule ?? 'none') !== 'none') {
      const initialsPages = resolveInitialsPages(tpl.initialsRule, (tpl.initialsPages as number[] | null) ?? [], contentPages);
      if (initialsPages.length) {
        const targets = initialsRecipientIndexes(tpl.initialsParty ?? 'client', recipients.length);
        const zones = initialsZones(targets.length);
        targets.forEach((rIdx, k) => {
          fields.push({ name: `Initials ${rIdx + 1}`, type: 'initials', role: 'Client', recipient: rIdx, areas: initialsPages.map((page) => ({ page, ...zones[k] })) });
        });
      }
    }
    const pdf = Buffer.from(await doc.save());
    const ownerUserId = (await this.prisma.deal.findFirst({ where: { id: dto.dealId, orgId }, select: { ownerUserId: true } }))?.ownerUserId ?? null;
    const wantEmail = dto.sendEmail ?? true;
    const candangoEmail = wantEmail && (await this.ownerHasMailbox(orgId, ownerUserId));

    const sub = await this.documenso.createPdfSubmission({ name: tpl.name, fileBytes: pdf, fields, recipients, sendEmail: wantEmail && !candangoEmail });
    if (candangoEmail && ownerUserId) await this.sendInvites(orgId, ownerUserId, dto.dealId, tpl.name, sub.recipients);

    // Store the generated PDF so the deal card can preview it (upload mode already has its source).
    let sourceKey: string | null = tpl.mode === 'upload' ? tpl.fileKey : null;
    if (tpl.mode !== 'upload' && this.spaces.configured) {
      sourceKey = `org-${orgId}/signature/gen-${sub.documentId}.pdf`;
      await this.spaces.putBytes(sourceKey, pdf, 'application/pdf').catch(() => {});
    }

    const row = await this.prisma.signatureRequest.create({
      data: {
        orgId,
        dealId: dto.dealId,
        title: tpl.name,
        status: 'sent',
        recipients: this.mergeRecipients(recipients, sub.recipients) as object,
        hasInitials: fields.some((f) => f.type === 'initials'),
        signerName: signerName ?? null,
        signerEmail,
        sourceFileKey: sourceKey,
        documensoDocumentId: sub.documentId,
        createdByUserId: userId,
        sentAt: new Date(),
      },
    });
    return { ...shape(row), signingUrl: sub.signingUrl };
  }

  /**
   * The signing parties: the client, plus (when both parties sign) the second party — resolved from
   * the template's config: either the deal owner (salesperson) or a fixed workspace user.
   */
  private async resolveRecipients(
    orgId: string,
    dealId: string,
    client: { email: string; name?: string },
    party2: { enabled: boolean; source: 'owner' | 'user'; userId?: string | null },
  ): Promise<{ email: string; name?: string; owner: boolean }[]> {
    const recipients: { email: string; name?: string; owner: boolean }[] = [{ email: client.email, name: client.name, owner: false }];
    if (party2.enabled) {
      const u =
        party2.source === 'user' && party2.userId
          ? await this.prisma.user.findFirst({ where: { id: party2.userId, orgId }, select: { name: true, firstName: true, lastName: true, email: true } })
          : (await this.prisma.deal.findFirst({ where: { id: dealId, orgId }, select: { owner: { select: { name: true, firstName: true, lastName: true, email: true } } } }))?.owner ?? null;
      if (!u?.email) {
        throw new BadRequestException(
          party2.source === 'user' ? 'The template’s second signer (a workspace user) has no email.' : 'The deal owner has no email — can’t add them as the second signer.',
        );
      }
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.name || undefined;
      if (u.email.toLowerCase() !== client.email.toLowerCase()) recipients.push({ email: u.email, name, owner: true });
    }
    return recipients;
  }

  /**
   * The heading shown above each party's signature block: the client's block is titled with the
   * deal's company name (else "Client"); the second party's block is titled with the workspace name
   * (the company sending) — not the individual signer's personal name.
   */
  private async partyBlockLabels(orgId: string, dealId: string): Promise<{ client: string; workspace: string }> {
    const [deal, org] = await Promise.all([
      this.prisma.deal.findFirst({ where: { id: dealId, orgId }, select: { company: { select: { name: true } } } }),
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true } }),
    ]);
    return { client: deal?.company?.name?.trim() || 'Client', workspace: org?.name?.trim() || 'Company' };
  }

  /** Merge our recipients (with owner flags) with Documenso's signing URLs for storage. */
  private mergeRecipients(recipients: { email: string; name?: string; owner: boolean }[], subRecipients: { email: string; name: string; signingUrl?: string }[]) {
    return recipients.map((r, i) => ({ email: r.email, name: r.name ?? subRecipients[i]?.name ?? '', owner: r.owner, signingUrl: subRecipients[i]?.signingUrl ?? null }));
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
      if (row.status !== 'signed') await this.markSigned(row);
    } else if (event === 'DOCUMENT_OPENED') {
      if (!row.viewedAt) {
        await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: row.status === 'sent' ? 'viewed' : row.status, viewedAt: new Date() } });
      }
    } else if (event === 'DOCUMENT_REJECTED' || event === 'DOCUMENT_CANCELLED') {
      await this.prisma.signatureRequest.update({ where: { id: row.id }, data: { status: 'declined', declinedAt: new Date() } });
    }
  }
}

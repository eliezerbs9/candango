import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';

/** Normalise deal labels: trim, drop blanks, dedupe, cap at 30. */
const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 30) : undefined;

export interface DealFilters {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  ownerUserId?: string;
  archived?: boolean;
}

/** Shape of `Organization.winRequirements`. Empty / `enabled:false` ⇒ "Any time". */
export interface WinRequirementsConfig {
  enabled?: boolean;
  stageIds?: string[]; // deal must be in one of these stages
  requireAcceptedProposal?: boolean; // ≥1 accepted proposal
  requireSignedDocument?: boolean; // ≥1 signed document
  signedTemplateIds?: string[]; // optional: the signed doc must come from one of these builder templates
  requireInvoice?: boolean; // ≥1 invoice — only enforced while QuickBooks is connected
}

export interface WinRequirement {
  key: 'fields' | 'stage' | 'proposal' | 'signed' | 'invoice';
  label: string;
  met: boolean;
}

export interface WinCheck {
  canWin: boolean;
  requirements: WinRequirement[];
}

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private emit(orgId: string, type: string, deal: unknown) {
    this.events.emit('webhook.event', { orgId, type, data: { deal } });
  }

  private logStage(orgId: string, dealId: string, fromStageId: string | null, toStageId: string, userId?: string) {
    return this.prisma.dealStageEvent.create({
      data: { orgId, dealId, fromStageId, toStageId, changedByUserId: userId ?? null },
    });
  }

  /** The stages a deal passed through (oldest first), with stage names resolved. */
  async stageHistory(orgId: string, id: string) {
    await this.get(orgId, id);
    const events = await this.prisma.dealStageEvent.findMany({
      where: { orgId, dealId: id },
      orderBy: { createdAt: 'asc' },
    });
    const ids = [...new Set(events.flatMap((e) => [e.fromStageId, e.toStageId]).filter(Boolean))] as string[];
    const stages = await this.prisma.stage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameOf = (sid: string | null) => (sid ? (stages.find((s) => s.id === sid)?.name ?? null) : null);
    return events.map((e) => ({
      id: e.id,
      fromStage: e.fromStageId ? { id: e.fromStageId, name: nameOf(e.fromStageId) } : null,
      toStage: { id: e.toStageId, name: nameOf(e.toStageId) },
      changedByUserId: e.changedByUserId,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Unified, cursor-paginated deal timeline — merges notes, activities, stage
   * events and emails newest-first. Cursor is "<ISO at>|<id>"; we over-fetch
   * `limit + 1` of the newest-after-cursor rows from each source, merge, sort by
   * (at desc, id desc) and slice — so each page is a real DB fetch, not the
   * whole history. `at` = a message's sentAt (else createdAt), createdAt for the
   * rest.
   */
  async timeline(orgId: string, id: string, cursor?: string, limit = 15) {
    await this.get(orgId, id);
    const take = Math.min(Math.max(limit, 1), 50);

    let cursorAt: Date | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const sep = cursor.lastIndexOf('|');
      cursorAt = new Date(cursor.slice(0, sep));
      cursorId = cursor.slice(sep + 1);
    }
    // "strictly older than (cursorAt, cursorId)" for a given date column.
    const olderCreated = cursor
      ? { OR: [{ createdAt: { lt: cursorAt! } }, { createdAt: cursorAt!, id: { lt: cursorId! } }] }
      : {};
    const olderSent = cursor
      ? { OR: [{ sentAt: { lt: cursorAt! } }, { sentAt: cursorAt!, id: { lt: cursorId! } }] }
      : {};
    const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [notes, activities, stageEvents, messages] = await Promise.all([
      this.prisma.note.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
        include: { author: { select: { name: true, email: true } } },
      }),
      this.prisma.activity.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
      }),
      this.prisma.dealStageEvent.findMany({
        where: { orgId, dealId: id, ...olderCreated },
        orderBy: order,
        take: take + 1,
      }),
      this.prisma.message.findMany({
        where: { orgId, dealId: id, ...olderSent },
        orderBy: [{ sentAt: 'desc' as const }, { id: 'desc' as const }],
        take: take + 1,
      }),
    ]);

    const stageIds = [
      ...new Set(stageEvents.flatMap((e) => [e.fromStageId, e.toStageId]).filter(Boolean)),
    ] as string[];
    const stages = stageIds.length
      ? await this.prisma.stage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } })
      : [];
    const nameOf = (sid: string | null) => (sid ? stages.find((s) => s.id === sid)?.name ?? null : null);

    type Item = { kind: string; at: Date; id: string; [k: string]: unknown };
    const pool: Item[] = [
      ...notes.map((n) => ({ kind: 'note', at: n.createdAt, id: n.id, body: n.body, author: n.author.name || n.author.email })),
      ...activities.map((a) => ({ kind: 'activity', at: a.createdAt, id: a.id, atype: a.type, subject: a.subject, done: a.done })),
      ...stageEvents.map((e) => ({ kind: 'stage', at: e.createdAt, id: e.id, from: nameOf(e.fromStageId), to: nameOf(e.toStageId) ?? 'Stage' })),
      ...messages.map((m) => ({ kind: 'email', at: m.sentAt ?? m.createdAt, id: m.id, direction: m.direction, subject: m.subject, snippet: m.snippet, from: m.fromAddress, threadId: m.threadId })),
    ];
    pool.sort((x, y) => {
      const d = y.at.getTime() - x.at.getTime();
      return d !== 0 ? d : x.id < y.id ? 1 : -1;
    });

    const hasMore = pool.length > take;
    const page = pool.slice(0, take);
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${last.at.toISOString()}|${last.id}` : null;
    return { items: page.map((i) => ({ ...i, at: i.at.toISOString() })), nextCursor };
  }

  async list(orgId: string, filters: DealFilters = {}) {
    const deals = await this.prisma.deal.findMany({
      where: {
        orgId,
        deletedAt: null,
        archivedAt: filters.archived ? { not: null } : null, // active by default; archived view on request
        pipelineId: filters.pipelineId,
        stageId: filters.stageId,
        status: filters.status,
        ownerUserId: filters.ownerUserId,
      },
      orderBy: { updatedAt: 'desc' },
    });
    // Attach each deal's last-activity timestamp (for the pipeline card) — one grouped query.
    const ids = deals.map((d) => d.id);
    const acts = ids.length
      ? await this.prisma.activity.groupBy({ by: ['dealId'], where: { orgId, dealId: { in: ids } }, _max: { createdAt: true } })
      : [];
    const lastByDeal = new Map(acts.map((a) => [a.dealId, a._max.createdAt]));
    return deals.map((d) => ({ ...d, lastActivityAt: lastByDeal.get(d.id) ?? null }));
  }

  async create(orgId: string, ownerUserId: string, dto: CreateDealDto) {
    // Auto-fill Bill To from the payer (company, else the primary person) when not provided; Ship To stays empty.
    let billTo = dto.billTo as Prisma.InputJsonValue | undefined;
    if (!billTo && dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, orgId },
        select: { name: true, address: true },
      });
      if (company) {
        billTo = { name: company.name, ...((company.address as Record<string, unknown>) ?? {}) };
      }
    }
    if (!billTo && dto.primaryPersonId) {
      const person = await this.prisma.person.findFirst({
        where: { id: dto.primaryPersonId, orgId },
        select: { name: true, address: true },
      });
      if (person) {
        billTo = { name: person.name, ...((person.address as Record<string, unknown>) ?? {}) };
      }
    }
    // Assign a human-readable per-tenant deal number from an atomic org counter.
    const deal = await this.prisma.$tx(async (tx) => {
      const org = await tx.organization.update({
        where: { id: orgId },
        data: { dealSeq: { increment: 1 } },
        select: { dealSeq: true },
      });
      return tx.deal.create({
        data: {
          orgId,
          ownerUserId,
          refNumber: org.dealSeq,
          title: dto.title,
          value: dto.value ?? 0,
          currency: dto.currency ?? 'USD',
          pipelineId: dto.pipelineId,
          stageId: dto.stageId,
          primaryPersonId: dto.primaryPersonId ?? null,
          companyId: dto.companyId ?? null,
          tags: cleanTags(dto.tags) ?? [],
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          shipTo: dto.shipTo as Prisma.InputJsonValue | undefined,
          billTo,
          customFields: dto.customFields as Prisma.InputJsonValue | undefined,
          status: 'open',
          stageChangedAt: new Date(),
        },
      });
    });
    await this.logStage(orgId, deal.id, null, deal.stageId, ownerUserId);
    // Link any extra participants (people other than the primary contact, which is already the client).
    const extraParticipants = [...new Set(dto.participantIds ?? [])].filter((pid) => pid && pid !== dto.primaryPersonId);
    if (extraParticipants.length) {
      const valid = await this.prisma.person.findMany({
        where: { id: { in: extraParticipants }, orgId, deletedAt: null },
        select: { id: true },
      });
      if (valid.length) {
        await this.prisma.dealParticipant.createMany({
          data: valid.map((p) => ({ dealId: deal.id, personId: p.id })),
          skipDuplicates: true,
        });
      }
    }
    // Seed an initial native estimate so the deal's value is always backed by an
    // estimate (FR-13.11). An empty/zero value seeds nothing (value 0).
    if ((dto.value ?? 0) > 0) {
      await this.prisma.dealEstimate.create({
        data: {
          orgId,
          dealId: deal.id,
          source: 'native',
          status: 'draft',
          currency: deal.currency,
          totalAmount: dto.value!,
          includeInValue: true,
          lines: {
            create: [
              {
                position: 0,
                description: 'Deal value',
                quantity: 1,
                unitPrice: dto.value!,
                amount: dto.value!,
                qbLineId: null,
                itemId: null,
                itemName: null,
              },
            ],
          },
        },
      });
    }
    this.emit(orgId, 'deal.created', deal);
    return deal;
  }

  async get(orgId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  /**
   * The deal's people for the email composer: primary contact first, then participants, then the
   * deal company's contacts — deduped. Resolved from the deal's actual relations (not the global
   * person list), so it works regardless of client-side data. `email` may be null.
   */
  async recipients(orgId: string, id: string) {
    const personSelect = { id: true, name: true, firstName: true, lastName: true, emails: true } as const;
    const deal = await this.prisma.deal.findFirst({
      where: { id, orgId, deletedAt: null },
      select: {
        primaryPerson: { select: personSelect },
        participants: { select: { person: { select: personSelect } } },
        company: { select: { contacts: { select: { person: { select: personSelect } } } } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const firstEmail = (emails: unknown): string | null => {
      if (!Array.isArray(emails) || emails.length === 0) return null;
      const e = emails[0];
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object' && typeof (e as { value?: unknown }).value === 'string') {
        return (e as { value: string }).value;
      }
      return null;
    };

    type P = { id: string; name: string; firstName: string; lastName: string; emails: unknown };
    const ordered: P[] = [
      ...(deal.primaryPerson ? [deal.primaryPerson] : []),
      ...deal.participants.map((p) => p.person),
      ...(deal.company?.contacts.map((c) => c.person) ?? []),
    ];
    const seen = new Set<string>();
    const people: { id: string; name: string; firstName: string; lastName: string; email: string | null }[] = [];
    for (const p of ordered) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      people.push({ id: p.id, name: p.name || `${p.firstName} ${p.lastName}`.trim(), firstName: p.firstName, lastName: p.lastName, email: firstEmail(p.emails) });
    }
    return people;
  }

  /** Link a person to the deal as a participant (idempotent) — e.g. a newly-created signer. */
  async addParticipant(orgId: string, dealId: string, personId: string) {
    const [deal, person] = await Promise.all([
      this.prisma.deal.findFirst({ where: { id: dealId, orgId, deletedAt: null }, select: { id: true } }),
      this.prisma.person.findFirst({ where: { id: personId, orgId }, select: { id: true } }),
    ]);
    if (!deal) throw new NotFoundException('Deal not found');
    if (!person) throw new NotFoundException('Person not found');
    await this.prisma.dealParticipant.upsert({
      where: { dealId_personId: { dealId, personId } },
      create: { dealId, personId },
      update: {},
    });
    return { ok: true };
  }

  /** Unlink a participant (only manually-added ones exist as rows; primary/company-primary are derived). */
  async removeParticipant(orgId: string, dealId: string, personId: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, orgId, deletedAt: null }, select: { id: true } });
    if (!deal) throw new NotFoundException('Deal not found');
    await this.prisma.dealParticipant.deleteMany({ where: { dealId, personId } });
    return { ok: true };
  }

  /**
   * The deal's people **with addresses** for the client/participants UI and the Bill/Ship-To picker:
   * the deal's **primary contact**, the **company's primary contact**, and any manually-added
   * **participants** — deduped, each tagged with its `source`. (`participant` rows are removable.)
   */
  async dealParticipants(orgId: string, id: string) {
    const personSelect = { id: true, name: true, firstName: true, lastName: true, emails: true, phones: true, address: true, customFields: true } as const;
    const deal = await this.prisma.deal.findFirst({
      where: { id, orgId, deletedAt: null },
      select: {
        primaryPersonId: true,
        customFields: true,
        primaryPerson: { select: personSelect },
        company: { select: { primaryContactId: true, contacts: { select: { person: { select: personSelect } } } } },
        participants: { select: { person: { select: personSelect } } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    // Any `person`-type custom field on the deal also makes that person a participant.
    const personFieldDefs = await this.prisma.customFieldDefinition.findMany({
      where: { orgId, entity: 'deal', type: 'person' },
      select: { key: true },
    });
    const cf = (deal.customFields ?? {}) as Record<string, unknown>;
    const fieldPersonIds = [...new Set(personFieldDefs.map((d) => cf[d.key]).filter((x): x is string => typeof x === 'string' && !!x))];
    const fieldPersons = fieldPersonIds.length
      ? await this.prisma.person.findMany({ where: { id: { in: fieldPersonIds }, orgId, deletedAt: null }, select: personSelect })
      : [];

    const companyPrimary = deal.company?.contacts.map((c) => c.person).find((p) => p.id === deal.company?.primaryContactId) ?? null;
    const firstVal = (arr: unknown): string | null => {
      if (!Array.isArray(arr) || !arr.length) return null;
      const e = arr[0];
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object' && typeof (e as { value?: unknown }).value === 'string') return (e as { value: string }).value;
      return null;
    };
    type P = { id: string; name: string; firstName: string; lastName: string; emails: unknown; phones: unknown; address: unknown; customFields: unknown };
    const tagged: { p: P; source: 'deal-primary' | 'company-primary' | 'participant' | 'field' }[] = [
      ...(deal.primaryPerson ? [{ p: deal.primaryPerson as P, source: 'deal-primary' as const }] : []),
      ...(companyPrimary ? [{ p: companyPrimary as P, source: 'company-primary' as const }] : []),
      ...deal.participants.map((x) => ({ p: x.person as P, source: 'participant' as const })),
      ...fieldPersons.map((p) => ({ p: p as P, source: 'field' as const })),
    ];
    const seen = new Set<string>();
    const out: {
      id: string; name: string; email: string | null; phone: string | null;
      address: Record<string, unknown> | null; customFields: Record<string, unknown>; source: string; removable: boolean;
    }[] = [];
    for (const { p, source } of tagged) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        id: p.id,
        name: p.name || `${p.firstName} ${p.lastName}`.trim(),
        email: firstVal(p.emails),
        phone: firstVal(p.phones),
        address: (p.address as Record<string, unknown> | null) ?? null,
        customFields: (p.customFields as Record<string, unknown> | null) ?? {},
        source,
        removable: source === 'participant',
      });
    }
    return out;
  }

  private isBlank(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  /**
   * Enforce required custom fields on a deal at a gate: `stage` (moving into `stageId`) or `win`.
   * A field is due when its `requiredFromStageId` is at/before the deal's stage (same pipeline), and
   * on the `win` gate additionally when it is `required` or `requiredForWon`. Throws listing any blanks.
   */
  private async assertRequiredFields(
    orgId: string,
    params: { stageId: string; pipelineId: string; customFields: Record<string, unknown>; gate: 'stage' | 'win' },
  ) {
    const { missing } = await this.computeRequiredFields(orgId, params);
    if (missing.length) {
      throw new BadRequestException(
        `Fill required field${missing.length > 1 ? 's' : ''} first: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Which required custom fields are due at this gate and which of those are blank.
   * `hasAny` = at least one field is due at this gate (so the caller can decide whether
   * to surface a "required fields" requirement at all). Does not throw — see
   * `assertRequiredFields` for the throwing wrapper.
   */
  private async computeRequiredFields(
    orgId: string,
    params: { stageId: string; pipelineId: string; customFields: Record<string, unknown>; gate: 'stage' | 'win' },
  ): Promise<{ hasAny: boolean; missing: string[] }> {
    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { orgId, entity: 'deal' },
      select: { key: true, label: true, required: true, requiredForWon: true, requiredFromStageId: true },
    });
    const relevant = defs.filter((d) => d.required || d.requiredForWon || d.requiredFromStageId);
    if (relevant.length === 0) return { hasAny: false, missing: [] };

    const reqStageIds = relevant.map((d) => d.requiredFromStageId).filter((s): s is string => !!s);
    const stages = reqStageIds.length
      ? await this.prisma.stage.findMany({
          where: { id: { in: [...reqStageIds, params.stageId] } },
          select: { id: true, position: true, pipelineId: true },
        })
      : [];
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const curPos = stageById.get(params.stageId)?.position ?? -1;

    const missing: string[] = [];
    let hasAny = false;
    for (const d of relevant) {
      let due = false;
      if (d.requiredFromStageId) {
        const rs = stageById.get(d.requiredFromStageId);
        // Compare position only within the deal's own pipeline.
        if (rs && rs.pipelineId === params.pipelineId && curPos >= rs.position) due = true;
      }
      if (params.gate === 'win' && (d.required || d.requiredForWon)) due = true;
      if (due) {
        hasAny = true;
        if (this.isBlank(params.customFields[d.key])) missing.push(d.label);
      }
    }
    return { hasAny, missing };
  }

  /**
   * Evaluate the workspace's Win Requirements against a deal. Returns each active
   * requirement with a met/unmet flag so the UI can disable "Mark won" and show a
   * checklist, and so `win()` can enforce the same rules server-side. Always includes
   * a "required fields" item when any are due (independent of `winRequirements`).
   */
  async getWinCheck(orgId: string, id: string): Promise<WinCheck> {
    await this.get(orgId, id);
    const rec = await this.prisma.deal.findFirstOrThrow({
      where: { id },
      select: { stageId: true, pipelineId: true, customFields: true },
    });
    const requirements: WinRequirement[] = [];

    // Required custom fields (always on — driven by the Fields page, not winRequirements).
    const fields = await this.computeRequiredFields(orgId, {
      stageId: rec.stageId,
      pipelineId: rec.pipelineId,
      customFields: (rec.customFields ?? {}) as Record<string, unknown>,
      gate: 'win',
    });
    if (fields.hasAny) {
      requirements.push({
        key: 'fields',
        label: fields.missing.length ? `Required fields: ${fields.missing.join(', ')}` : 'Required fields filled',
        met: fields.missing.length === 0,
      });
    }

    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: orgId },
      select: { winRequirements: true },
    });
    const wr = (org.winRequirements ?? {}) as WinRequirementsConfig;

    if (wr.enabled) {
      if (wr.stageIds?.length) {
        requirements.push({
          key: 'stage',
          label: 'Deal is in an allowed stage',
          met: wr.stageIds.includes(rec.stageId),
        });
      }
      if (wr.requireAcceptedProposal) {
        const accepted = await this.prisma.proposal.count({ where: { orgId, dealId: id, status: 'accepted' } });
        requirements.push({ key: 'proposal', label: 'Has an accepted proposal', met: accepted > 0 });
      }
      if (wr.requireSignedDocument) {
        const where: Prisma.SignatureRequestWhereInput = { orgId, dealId: id, status: 'signed' };
        if (wr.signedTemplateIds?.length) where.signableDocumentTemplateId = { in: wr.signedTemplateIds };
        const signed = await this.prisma.signatureRequest.count({ where });

        // Name the required template(s) so the checklist reads e.g. «Requires "Contract" to be signed».
        let label = 'Has a signed document';
        if (wr.signedTemplateIds?.length) {
          const tpls = await this.prisma.signableDocumentTemplate.findMany({
            where: { orgId, id: { in: wr.signedTemplateIds } },
            select: { name: true },
          });
          const names = tpls.map((t) => `“${t.name}”`);
          if (names.length === 1) label = `Requires ${names[0]} to be signed`;
          else if (names.length > 1) label = `Requires one of these signed: ${names.join(', ')}`;
        }
        requirements.push({ key: 'signed', label, met: signed > 0 });
      }
      // Invoice rule only applies while QuickBooks is connected (invoices are a QBO concept).
      if (wr.requireInvoice) {
        const qbo = await this.prisma.quickBooksConnection.findUnique({
          where: { orgId },
          select: { status: true },
        });
        if (qbo && qbo.status !== 'disconnected') {
          const invoices = await this.prisma.dealInvoice.count({
            where: { orgId, dealId: id, deletedAt: null, status: { not: 'void' } },
          });
          requirements.push({ key: 'invoice', label: 'Has an invoice', met: invoices > 0 });
        }
      }
    }

    return { canWin: requirements.every((r) => r.met), requirements };
  }

  async update(orgId: string, id: string, dto: UpdateDealDto, currentUserId?: string) {
    const before = await this.get(orgId, id);
    const data: Prisma.DealUncheckedUpdateInput = {
      title: dto.title,
      currency: dto.currency,
    };
    // The deal value is estimate-driven once the deal has any estimates — a
    // manual value is only allowed while there are none (FR-13.11).
    if (dto.value !== undefined) {
      const estCount = await this.prisma.dealEstimate.count({ where: { orgId, dealId: id, deletedAt: null } });
      if (estCount === 0) data.value = dto.value;
    }
    if (dto.ownerUserId) data.ownerUserId = dto.ownerUserId;
    // Note: a QuickBooks-linked deal's client is NOT hard-locked — changing the company/primary
    // contact is allowed; the UI just warns (it won't re-parent the existing billing account).
    if (dto.primaryPersonId !== undefined) data.primaryPersonId = dto.primaryPersonId || null;
    if (dto.companyId !== undefined) data.companyId = dto.companyId || null;
    if (dto.tags !== undefined) data.tags = cleanTags(dto.tags);
    if (dto.expectedCloseDate) data.expectedCloseDate = new Date(dto.expectedCloseDate);
    if (dto.shipTo !== undefined) data.shipTo = dto.shipTo as Prisma.InputJsonValue;
    if (dto.billTo !== undefined) data.billTo = dto.billTo as Prisma.InputJsonValue;
    if (dto.customFields !== undefined) data.customFields = dto.customFields as Prisma.InputJsonValue;
    if (dto.stageId) {
      data.stageId = dto.stageId;
      data.stageChangedAt = new Date(); // moving stage resets the rotting timer
    }
    // Gate a stage change on the deal's required custom fields for the target stage.
    if (dto.stageId && dto.stageId !== before.stageId) {
      const rec = await this.prisma.deal.findFirstOrThrow({ where: { id }, select: { pipelineId: true, customFields: true } });
      await this.assertRequiredFields(orgId, {
        stageId: dto.stageId,
        pipelineId: rec.pipelineId,
        customFields: (dto.customFields ?? rec.customFields ?? {}) as Record<string, unknown>,
        gate: 'stage',
      });
    }
    const deal = await this.prisma.deal.update({ where: { id }, data });
    if (dto.stageId && dto.stageId !== before.stageId) {
      await this.logStage(orgId, id, before.stageId, dto.stageId, currentUserId);
      this.emit(orgId, 'deal.stage_changed', deal);
    }
    this.emit(orgId, 'deal.updated', deal);
    return deal;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
    this.emit(orgId, 'deal.deleted', { id });
  }

  /** System note on the deal timeline recording a lifecycle change. */
  private logStatusNote(orgId: string, dealId: string, userId: string, body: string) {
    return this.prisma.note.create({ data: { orgId, dealId, authorUserId: userId, body } });
  }

  async win(orgId: string, id: string, userId: string) {
    // Enforce Win Requirements server-side (required fields + workspace win rules) so
    // the API/automation path can't bypass the disabled button.
    const check = await this.getWinCheck(orgId, id);
    if (!check.canWin) {
      const unmet = check.requirements.filter((r) => !r.met).map((r) => r.label);
      throw new BadRequestException(`Can't mark won yet — ${unmet.join('; ')}`);
    }
    const deal = await this.prisma.deal.update({ where: { id }, data: { status: 'won' } });
    await this.logStatusNote(orgId, id, userId, '✅ Deal marked won');
    this.emit(orgId, 'deal.won', deal);
    return deal;
  }

  async lose(orgId: string, id: string, userId: string, lostReason?: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { status: 'lost', lostReason: lostReason ?? null },
    });
    await this.logStatusNote(orgId, id, userId, `🔴 Deal marked lost${lostReason ? `: ${lostReason}` : ''}`);
    this.emit(orgId, 'deal.lost', deal);
    return deal;
  }

  /** Reopen a won/lost/archived deal back to open (clears archive + lost reason; resets rotting timer). */
  async reopen(orgId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { status: 'open', lostReason: null, archivedAt: null, stageChangedAt: new Date() },
    });
    await this.logStatusNote(orgId, id, userId, '↩️ Deal reopened');
    this.emit(orgId, 'deal.reopened', deal);
    return deal;
  }

  /** Archive a deal: hidden from active views but kept (distinct from delete). */
  async archive(orgId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const deal = await this.prisma.deal.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.logStatusNote(orgId, id, userId, '📦 Deal archived');
    this.emit(orgId, 'deal.archived', deal);
    return deal;
  }
}

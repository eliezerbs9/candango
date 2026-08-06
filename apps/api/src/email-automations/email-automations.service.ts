import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmailAutomationDto,
  CreateMarketingAutomationDto,
  UpdateEmailAutomationDto,
  UpdateMarketingAutomationDto,
} from './dto/email-automation.dto';
import { MarketingSchedule, computeNextRun, validateSchedule } from './marketing-schedule';
import { MarketingAudience, validateAudience } from './marketing-audience';
import { STARTER_RECIPES, RECIPE_GROUPS_WITH_RECIPES, type RecipeGroup } from './automation-recipes';

const shape = (a: {
  id: string;
  name: string;
  enabled: boolean;
  kind: string;
  category: string;
  tags: string[];
  trigger: string;
  action: string;
  config: Prisma.JsonValue;
  templateId: string | null;
  template?: { name: string } | null;
  timezone: string | null;
  startAt: Date | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  updatedAt: Date;
}) => ({
  id: a.id,
  name: a.name,
  enabled: a.enabled,
  kind: a.kind,
  category: a.category,
  tags: a.tags,
  trigger: a.trigger,
  action: a.action,
  config: (a.config ?? {}) as Record<string, unknown>,
  templateId: a.templateId,
  templateName: a.template?.name ?? null,
  timezone: a.timezone,
  startAt: a.startAt?.toISOString() ?? null,
  nextRunAt: a.nextRunAt?.toISOString() ?? null,
  lastRunAt: a.lastRunAt?.toISOString() ?? null,
  updatedAt: a.updatedAt.toISOString(),
});

const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20) : undefined;

@Injectable()
export class EmailAutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.emailAutomation.findMany({
      where: { orgId, archivedAt: null },
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shape);
  }

  /**
   * The send_email action needs a template that belongs to this org AND is deal-scoped — these
   * automations run in the context of one deal, so a marketing template (no deal/sender variables)
   * could never render correctly here.
   */
  private async validateAction(orgId: string, action: string, templateId?: string | null, config?: unknown) {
    if (action === 'send_email') {
      if (!templateId) throw new BadRequestException('Pick a template for the email action');
      const t = await this.prisma.emailTemplate.findFirst({ where: { id: templateId, orgId, archivedAt: null } });
      if (!t) throw new BadRequestException('Template not found');
      if (t.scope !== 'deal') {
        throw new BadRequestException('Pick a deal email template — marketing templates can’t be used in deal automations');
      }
    }
    if (action === 'request_signature') {
      const docId = (config as Record<string, unknown> | undefined)?.signableDocumentTemplateId;
      if (typeof docId !== 'string' || !docId) throw new BadRequestException('Pick a document template for the signature action');
      const doc = await this.prisma.signableDocumentTemplate.findFirst({ where: { id: docId, orgId, archivedAt: null } });
      if (!doc) throw new BadRequestException('Document template not found');
    }
    if (action === 'move_stage') {
      const stageId = (config as Record<string, unknown> | undefined)?.stageId;
      if (typeof stageId !== 'string' || !stageId) throw new BadRequestException('Pick the stage to move the deal to');
      const stage = await this.prisma.stage.findFirst({ where: { id: stageId, orgId } });
      if (!stage) throw new BadRequestException('Stage not found');
    }
    if (action === 'add_tag') {
      const tag = (config as Record<string, unknown> | undefined)?.tag;
      if (typeof tag !== 'string' || !tag.trim()) throw new BadRequestException('Enter a tag to add to the contact');
    }
  }

  /** Email automations can only be enabled when the workspace has at least one connected mailbox. */
  private async orgHasMailbox(orgId: string) {
    return (await this.prisma.mailboxConnection.count({ where: { orgId } })) > 0;
  }

  /** Starter-kit groups available to this org right now: `core` always, `gmail` once a mailbox is connected. */
  private async availableRecipeGroups(orgId: string): Promise<RecipeGroup[]> {
    const groups: RecipeGroup[] = ['core'];
    if (await this.orgHasMailbox(orgId)) groups.push('gmail');
    // 'quickbooks' has no recipes yet — added in the dedicated QB pass.
    return groups.filter((g) => RECIPE_GROUPS_WITH_RECIPES.includes(g));
  }

  /** Whether there's at least one available recipe group not yet seeded (drives the "Add recipes" button). */
  async seedStatus(orgId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { seededAutomationGroups: true } });
    const seeded = new Set(org?.seededAutomationGroups ?? []);
    const available = await this.availableRecipeGroups(orgId);
    return { seedable: available.some((g) => !seeded.has(g)) };
  }

  /**
   * Seed the starter-kit automations for every AVAILABLE group not yet seeded (each group at most once —
   * reconnecting an integration never re-seeds). Gmail recipes upsert their deal email template first.
   * Called by the "Add recipes" button and right after a Gmail connection.
   */
  async seedStarterKit(orgId: string, userId?: string) {
    const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { seededAutomationGroups: true } });
    const seeded = new Set(org?.seededAutomationGroups ?? []);
    const available = await this.availableRecipeGroups(orgId);
    const toSeed = available.filter((g) => !seeded.has(g));
    if (toSeed.length === 0) return { created: 0, groups: [] as string[] };

    let created = 0;
    for (const group of toSeed) {
      for (const r of STARTER_RECIPES.filter((x) => x.group === group)) {
        let templateId: string | null = null;
        if (r.template) {
          // Regular (NOT system) templates — deletable/editable. No systemKey; the group-seeds-once flag
          // already prevents duplicates, so no upsert is needed.
          const tpl = await this.prisma.emailTemplate.create({
            data: { orgId, name: r.template.name, subject: r.template.subject, body: r.template.body, bodyFormat: 'richtext', scope: 'deal', createdByUserId: userId ?? null },
          });
          templateId = tpl.id;
        }
        // Adequate tags per recipe: a 'starter' marker + its category + 'email' for email actions.
        const tags = Array.from(new Set(['starter', r.category, ...(r.action === 'send_email' ? ['email'] : [])]));
        await this.prisma.emailAutomation.create({
          data: {
            orgId,
            createdByUserId: userId ?? null,
            name: r.name,
            category: r.category,
            tags,
            kind: 'deal',
            trigger: r.trigger,
            action: r.action,
            templateId,
            config: (r.config ?? {}) as Prisma.InputJsonValue,
            enabled: false, // starter automations arrive OFF — the user reviews and flips each one on
          },
        });
        created++;
      }
    }
    await this.prisma.organization.update({ where: { id: orgId }, data: { seededAutomationGroups: { push: toSeed } } });
    return { created, groups: toSeed };
  }

  async create(orgId: string, userId: string, dto: CreateEmailAutomationDto) {
    await this.validateAction(orgId, dto.action, dto.templateId, dto.config);
    // An email automation can be created without Google, but starts OFF until a mailbox is connected.
    let enabled = dto.enabled ?? true;
    if (dto.action === 'send_email' && enabled && !(await this.orgHasMailbox(orgId))) enabled = false;
    const row = await this.prisma.emailAutomation.create({
      data: {
        orgId,
        createdByUserId: userId,
        name: dto.name.trim(),
        category: dto.category ?? 'general',
        tags: cleanTags(dto.tags) ?? [],
        trigger: dto.trigger,
        action: dto.action,
        templateId: dto.action === 'send_email' ? dto.templateId : null,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        enabled,
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateEmailAutomationDto) {
    const existing = await this.prisma.emailAutomation.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Automation not found');
    const action = dto.action ?? existing.action;
    const templateId = dto.templateId !== undefined ? dto.templateId : existing.templateId;
    const config = dto.config !== undefined ? dto.config : existing.config;
    if (dto.action !== undefined || dto.templateId !== undefined || dto.config !== undefined) await this.validateAction(orgId, action, templateId, config);
    // Block turning ON an email automation until the workspace has a connected mailbox.
    const willEnable = dto.enabled !== undefined ? dto.enabled : existing.enabled;
    if (action === 'send_email' && willEnable && !(await this.orgHasMailbox(orgId))) {
      throw new BadRequestException('Connect Google (Gmail) before enabling email automations');
    }
    const row = await this.prisma.emailAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.tags !== undefined ? { tags: cleanTags(dto.tags) } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.action !== undefined ? { action: dto.action } : {}),
        ...(dto.action !== undefined || dto.templateId !== undefined
          ? { templateId: action === 'send_email' ? templateId : null }
          : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.emailAutomation.findFirst({ where: { id, orgId, archivedAt: null } });
    if (!existing) throw new NotFoundException('Automation not found');
    await this.prisma.emailAutomation.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  // ── Marketing automations (kind = 'marketing') ──────────────────────────────
  // Scheduled broadcasts to an audience. Sent from the workspace via the system mailer (Brevo),
  // so — unlike deal email automations — they do NOT require a connected Gmail mailbox.

  /** A marketing automation needs a marketing-scoped template that belongs to this org. */
  private async validateMarketingTemplate(orgId: string, templateId: string) {
    const t = await this.prisma.emailTemplate.findFirst({ where: { id: templateId, orgId, archivedAt: null } });
    if (!t) throw new BadRequestException('Template not found');
    if (t.scope !== 'marketing') {
      throw new BadRequestException('Pick a marketing email template for a marketing automation');
    }
  }

  private assertScheduleAudience(schedule: MarketingSchedule, audience: MarketingAudience, timezone: string) {
    const s = validateSchedule(schedule, timezone);
    if (s) throw new BadRequestException(s);
    const a = validateAudience(audience);
    if (a) throw new BadRequestException(a);
  }

  /** First fire time for a schedule, honouring an optional not-before start instant. */
  private firstRun(schedule: MarketingSchedule, timezone: string, startAt: Date | null): Date | null {
    const now = new Date();
    const after = startAt && startAt.getTime() > now.getTime() ? new Date(startAt.getTime() - 1000) : now;
    return computeNextRun(schedule, timezone, after, startAt ?? now);
  }

  async createMarketing(orgId: string, userId: string, dto: CreateMarketingAutomationDto) {
    await this.validateMarketingTemplate(orgId, dto.templateId);
    this.assertScheduleAudience(dto.schedule, dto.audience, dto.timezone);
    const startAt = dto.startAt ? new Date(dto.startAt) : null;
    const enabled = dto.enabled ?? true;
    const nextRunAt = enabled ? this.firstRun(dto.schedule, dto.timezone, startAt) : null;
    const row = await this.prisma.emailAutomation.create({
      data: {
        orgId,
        createdByUserId: userId,
        kind: 'marketing',
        name: dto.name.trim(),
        category: dto.category ?? 'marketing',
        tags: cleanTags(dto.tags) ?? [],
        trigger: '',
        action: 'send_email',
        templateId: dto.templateId,
        config: { schedule: dto.schedule, audience: dto.audience } as unknown as Prisma.InputJsonValue,
        timezone: dto.timezone,
        startAt,
        nextRunAt,
        enabled,
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  async updateMarketing(orgId: string, id: string, dto: UpdateMarketingAutomationDto) {
    const existing = await this.prisma.emailAutomation.findFirst({
      where: { id, orgId, kind: 'marketing', archivedAt: null },
    });
    if (!existing) throw new NotFoundException('Marketing automation not found');
    if (dto.templateId !== undefined) await this.validateMarketingTemplate(orgId, dto.templateId);

    const cfg = (existing.config ?? {}) as { schedule?: MarketingSchedule; audience?: MarketingAudience };
    const schedule = dto.schedule ?? cfg.schedule;
    const audience = dto.audience ?? cfg.audience;
    const timezone = dto.timezone ?? existing.timezone ?? 'UTC';
    if (schedule && audience) this.assertScheduleAudience(schedule, audience, timezone);

    const startAt = dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : existing.startAt;
    const enabled = dto.enabled !== undefined ? dto.enabled : existing.enabled;
    // Recompute the next fire if anything affecting the timeline changed (or it was just enabled).
    const scheduleChanged =
      dto.schedule !== undefined || dto.timezone !== undefined || dto.startAt !== undefined || dto.enabled === true;
    const nextRunAt = !enabled
      ? null
      : scheduleChanged && schedule
        ? this.firstRun(schedule, timezone, startAt)
        : existing.nextRunAt;

    const row = await this.prisma.emailAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.tags !== undefined ? { tags: cleanTags(dto.tags) } : {}),
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.schedule !== undefined || dto.audience !== undefined
          ? { config: { schedule, audience } as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.startAt !== undefined ? { startAt } : {}),
        enabled,
        nextRunAt,
      },
      include: { template: { select: { name: true } } },
    });
    return shape(row);
  }

  /**
   * Resolve a marketing audience to the contacts that should receive the send: always restricted to
   * those subscribed to marketing email AND with an email address (opt-out enforcement lives here).
   */
  async resolveAudience(orgId: string, audience: MarketingAudience) {
    const base: Prisma.PersonWhereInput = { orgId, deletedAt: null, emailSubscribed: true };
    let where: Prisma.PersonWhereInput = base;

    if (audience.type === 'label') {
      where = { ...base, tags: { hasSome: audience.tags ?? [] } };
    } else if (audience.type === 'deal_stage') {
      const deals = await this.prisma.deal.findMany({
        where: { orgId, deletedAt: null, stageId: audience.stageId },
        select: { primaryPersonId: true, participants: { select: { personId: true } } },
      });
      const ids = new Set<string>();
      for (const d of deals) {
        if (d.primaryPersonId) ids.add(d.primaryPersonId);
        for (const p of d.participants) ids.add(p.personId);
      }
      if (ids.size === 0) return [];
      where = { ...base, id: { in: [...ids] } };
    } else if (audience.type === 'filter') {
      const f = audience.filter ?? {};
      where = {
        ...base,
        ...(f.tagsAny?.length ? { tags: { hasSome: f.tagsAny } } : {}),
        ...(f.tagsAll?.length ? { tags: { hasEvery: f.tagsAll } } : {}),
        ...(f.companyId ? { companyLinks: { some: { companyId: f.companyId } } } : {}),
      };
    }

    const rows = await this.prisma.person.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        emails: true,
        phones: true,
        emailUnsubToken: true,
        companyLinks: { take: 1, include: { company: { select: { name: true } } } },
      },
    });
    // Keep only those with a usable first email.
    return rows.filter((r) => Array.isArray(r.emails) && (r.emails as string[]).some((e) => typeof e === 'string' && e));
  }
}

import { OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { gmailFor } from './google.util';

interface SyncUserJob {
  userId: string;
}

/** Extract a bare email from a header value like `Jane <jane@acme.com>`. */
function parseAddr(v?: string | null): string | null {
  if (!v) return null;
  const m = v.match(/<([^>]+)>/);
  return (m ? m[1] : v).trim().toLowerCase() || null;
}
function parseAddrs(v?: string | null): string[] {
  if (!v) return [];
  return v.split(',').map(parseAddr).filter((e): e is string => !!e);
}

/** Map Gmail labelIds to a single folder for the Email screen. */
function deriveFolder(labelIds?: string[] | null): string {
  const l = labelIds ?? [];
  if (l.includes('TRASH')) return 'trash';
  if (l.includes('SPAM')) return 'spam';
  if (l.includes('SENT')) return 'sent';
  if (l.includes('INBOX')) return 'inbox';
  return 'other';
}

/**
 * ⛔ Full Gmail inbox sync is **DISABLED** (no-CASA launch). The `gmail.modify` restricted scope it
 * relies on would require a CASA security assessment, so we capture email via BCC / inbound-parse +
 * Reply-To instead ([[Email & Messaging Sync]]). The sync code below (`syncMailbox` + helpers) is
 * **retained, not executed** — it's the deferred CASA tier ([[Gmail Full Inbox Sync (CASA)]]).
 */
@Processor('gmail-sync')
export class GmailSyncProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('gmail-sync') private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    // Tear down any previously-scheduled poll so it stops firing where it was already registered
    // (e.g. prod Redis still has the old repeatable). No new poll is registered while disabled.
    const repeatables = await this.queue.getRepeatableJobs().catch(() => []);
    for (const r of repeatables) await this.queue.removeRepeatableByKey(r.key).catch(() => undefined);
  }

  async process(_job: Job): Promise<void> {
    // Disabled — see the class doc. Any stale enqueued job is a no-op.
    return;
  }

  private async syncMailbox(userId: string): Promise<void> {
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { userId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) return;

    const gmail = gmailFor(conn);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const myEmail = (profile.data.emailAddress ?? '').toLowerCase();

    // Build an email → personId map for this org (small data sets in practice).
    const persons = await this.prisma.person.findMany({
      where: { orgId: conn.orgId, deletedAt: null },
      select: { id: true, emails: true },
    });
    const personByEmail = new Map<string, string>();
    for (const p of persons) {
      for (const e of (p.emails as string[]) ?? []) personByEmail.set(e.toLowerCase(), p.id);
    }

    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'newer_than:30d',
      includeSpamTrash: true, // so Trash/Spam folders populate
    });
    const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
    if (!ids.length) return;

    // Re-fetch the whole recent window each sync so labels (read/unread, folder moves) stay fresh.
    // (For scale, switch to Gmail history.list incremental sync — future.)
    for (const id of ids) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      const headers = new Map(
        (full.data.payload?.headers ?? []).map((h) => [h.name?.toLowerCase() ?? '', h.value ?? '']),
      );
      const fromAddress = parseAddr(headers.get('from')) ?? 'unknown';
      const toAddresses = parseAddrs(headers.get('to'));
      const direction = fromAddress === myEmail ? 'out' : 'in';
      const dateHeader = headers.get('date');
      const sentAt = dateHeader
        ? new Date(dateHeader)
        : full.data.internalDate
          ? new Date(Number(full.data.internalDate))
          : null;

      const labels = full.data.labelIds ?? [];
      const folder = deriveFolder(labels);
      const others = direction === 'out' ? toAddresses : [fromAddress];
      const personId = others.map((e) => personByEmail.get(e)).find(Boolean) ?? null;

      // Link the message to a deal so it shows on the deal timeline (FR-5.2/3.9):
      let dealId: string | null = null;
      // 1. Thread continuity — a reply in a thread already linked to a deal stays on that deal.
      if (full.data.threadId) {
        const prior = await this.prisma.message.findFirst({
          where: { orgId: conn.orgId, threadId: full.data.threadId, dealId: { not: null } },
          select: { dealId: true },
        });
        dealId = prior?.dealId ?? null;
      }
      // 2. Otherwise match the contact — primary person, a deal participant, OR a contact of the
      //    deal's company — to the most recent open deal.
      if (!dealId && personId) {
        const deal = await this.prisma.deal.findFirst({
          where: {
            orgId: conn.orgId,
            status: 'open',
            deletedAt: null,
            OR: [
              { primaryPersonId: personId },
              { participants: { some: { personId } } },
              { company: { contacts: { some: { personId } } } },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        dealId = deal?.id ?? null;
      }

      await this.prisma.message.upsert({
        where: { userId_providerMessageId: { userId, providerMessageId: id } },
        create: {
          orgId: conn.orgId,
          userId,
          direction,
          providerMessageId: id,
          threadId: full.data.threadId ?? null,
          fromAddress,
          toAddresses: toAddresses as Prisma.InputJsonValue,
          subject: headers.get('subject') ?? null,
          snippet: full.data.snippet ?? null,
          folder,
          labels,
          personId,
          dealId,
          sentAt,
        },
        // refresh matching + folder/labels (e.g. moved to trash); never wipe an existing deal link on re-sync
        update: { personId, dealId: dealId ?? undefined, folder, labels },
      });
    }

    if (profile.data.historyId) {
      await this.prisma.mailboxConnection.update({
        where: { userId },
        data: { historyId: String(profile.data.historyId) },
      });
    }
  }
}

import { OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { gmailFor } from './google.util';

interface SyncUserJob {
  userId: string;
}

const POLL_MS = 5 * 60 * 1000;

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
 * Captures the connected user's recent Gmail and matches each message to a person → deal,
 * storing rows in `messages` (powers the Email screen + deal timeline, FR-5.2/5.5).
 * Runs on connect, on demand, and on a periodic poll. Idempotent via (userId, providerMessageId).
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
    // Periodic poll across all connected mailboxes (push notifications need a public URL).
    await this.queue.add('sync-all', {}, { repeat: { every: POLL_MS }, removeOnComplete: true, removeOnFail: true });
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'sync-all') {
      const conns = await this.prisma.mailboxConnection.findMany({
        where: { status: 'connected' },
        select: { userId: true },
      });
      for (const c of conns) await this.queue.add('sync-user', { userId: c.userId });
      return;
    }
    await this.syncMailbox((job.data as SyncUserJob).userId);
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
      const dealId = personId
        ? (
            await this.prisma.deal.findFirst({
              where: { orgId: conn.orgId, primaryPersonId: personId, status: 'open', deletedAt: null },
              orderBy: { updatedAt: 'desc' },
              select: { id: true },
            })
          )?.id ?? null
        : null;

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
        update: { personId, dealId, folder, labels }, // refresh matching + folder/labels (e.g. moved to trash)
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

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import type { calendar_v3 } from 'googleapis';
import { PrismaService } from './prisma.service';
import { calendarFor, tasksFor } from './google.util';

type CalendarSyncJob =
  | { op: 'upsert'; activityId: string }
  | { op: 'delete'; userId: string; kind: 'event' | 'task'; externalId: string };

const INBOUND_POLL_MS = 5 * 60 * 1000;
const INITIAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // first inbound sync looks back 30 days

const firstEmail = (emails: Prisma.JsonValue): string | null => ((emails as string[]) ?? [])[0] ?? null;

/**
 * Syncs an activity to Google: **meetings → Calendar events**, **calls/tasks/emails → Google Tasks**.
 * The Google item's description/notes is filled with the activity details. No-ops when the user
 * isn't connected; throws to trigger BullMQ retries.
 */
@Processor('calendar-sync')
export class CalendarSyncProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('calendar-sync') private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    // Periodic inbound reconcile across all connected calendars (push channels would need a public URL).
    await this.queue.add('pull-all', {}, { repeat: { every: INBOUND_POLL_MS }, removeOnComplete: true, removeOnFail: true });
  }

  private async connectionFor(userId: string) {
    const conn = await this.prisma.calendarConnection.findUnique({ where: { userId } });
    return conn && conn.status === 'connected' && conn.refreshToken ? conn : null;
  }

  async process(job: Job): Promise<void> {
    // --- Inbound poll (Google → Candango) ---
    if (job.name === 'pull-all') {
      const conns = await this.prisma.calendarConnection.findMany({
        where: { status: 'connected' },
        select: { userId: true },
      });
      for (const c of conns) await this.queue.add('pull-user', { userId: c.userId });
      return;
    }
    if (job.name === 'pull-user') {
      await this.pullCalendar((job.data as { userId: string }).userId);
      return;
    }

    // --- Outbound (Candango → Google) ---
    const data = job.data as CalendarSyncJob;
    if (data.op === 'delete') {
      const conn = await this.connectionFor(data.userId);
      if (!conn) return;
      if (data.kind === 'event') {
        await calendarFor(conn)
          .events.delete({ calendarId: 'primary', eventId: data.externalId, sendUpdates: 'none' })
          .catch(() => undefined);
      } else {
        await tasksFor(conn)
          .tasks.delete({ tasklist: '@default', task: data.externalId })
          .catch(() => undefined);
      }
      return;
    }

    const { activityId } = data;
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        participants: { include: { person: true } },
        calendarEvent: true,
        deal: { select: { title: true } },
      },
    });
    if (!activity?.assignedUserId) return;
    const conn = await this.connectionFor(activity.assignedUserId);
    if (!conn) return;

    const participantNames = activity.participants.map((p) => p.person.name);
    const description = this.describe(activity, activity.deal?.title ?? null, participantNames);

    if (activity.type === 'meeting') {
      await this.syncEvent(activity, conn, description);
    } else {
      await this.syncTask(activity, conn, description);
    }
  }

  private describe(
    activity: { type: string; location: string | null; locationType: string | null; conferenceUrl: string | null },
    dealTitle: string | null,
    participants: string[],
  ): string {
    const lines: string[] = [];
    if (dealTitle) lines.push(`Deal: ${dealTitle}`);
    lines.push(`Type: ${activity.type}`);
    if (participants.length) lines.push(`With: ${participants.join(', ')}`);
    if (activity.locationType === 'in_person' && activity.location) lines.push(`Location: ${activity.location}`);
    if (activity.locationType === 'video' && activity.conferenceUrl) lines.push(`Join: ${activity.conferenceUrl}`);
    lines.push('— Synced from Candango');
    return lines.join('\n');
  }

  private async syncEvent(
    activity: Prisma.ActivityGetPayload<{ include: { participants: { include: { person: true } }; calendarEvent: true } }>,
    conn: { accessToken: string; refreshToken: string },
    description: string,
  ) {
    if (!activity.startAt) return;
    const cal = calendarFor(conn);
    const attendees = activity.participants
      .map((p) => firstEmail(p.person.emails))
      .filter((e): e is string => !!e)
      .map((email) => ({ email }));
    const requestBody = {
      summary: activity.subject,
      description,
      start: { dateTime: activity.startAt.toISOString() },
      end: { dateTime: (activity.endAt ?? activity.startAt).toISOString() },
      location: activity.locationType === 'in_person' ? (activity.location ?? undefined) : undefined,
      attendees: attendees.length ? attendees : undefined,
    };

    if (activity.calendarEvent) {
      const res = await cal.events.patch({
        calendarId: 'primary',
        eventId: activity.calendarEvent.externalEventId,
        requestBody,
        sendUpdates: 'none',
      });
      await this.prisma.calendarEvent.update({
        where: { activityId: activity.id },
        data: { etag: res.data.etag ?? null, lastSyncedAt: new Date(), syncDirection: 'outbound' },
      });
    } else {
      const res = await cal.events.insert({ calendarId: 'primary', requestBody, sendUpdates: 'none' });
      if (!res.data.id) throw new Error('Google did not return an event id');
      await this.prisma.calendarEvent.create({
        data: {
          orgId: activity.orgId,
          activityId: activity.id,
          externalEventId: res.data.id,
          etag: res.data.etag ?? null,
          lastSyncedAt: new Date(),
          syncDirection: 'outbound',
        },
      });
      await this.prisma.activity.update({ where: { id: activity.id }, data: { calendarEventId: res.data.id } });
    }
  }

  private async syncTask(
    activity: { id: string; subject: string; done: boolean; dueAt: Date | null; startAt: Date | null; googleTaskId: string | null },
    conn: { accessToken: string; refreshToken: string },
    notes: string,
  ) {
    const tasks = tasksFor(conn);
    const due = activity.dueAt ?? activity.startAt;
    const requestBody = {
      title: activity.subject,
      notes,
      status: activity.done ? 'completed' : 'needsAction',
      due: due ? due.toISOString() : undefined,
    };

    if (activity.googleTaskId) {
      await tasks.tasks.patch({ tasklist: '@default', task: activity.googleTaskId, requestBody });
    } else {
      const res = await tasks.tasks.insert({ tasklist: '@default', requestBody });
      if (res.data.id) {
        await this.prisma.activity.update({ where: { id: activity.id }, data: { googleTaskId: res.data.id } });
      }
    }
  }

  // --- Inbound: pull Google Calendar changes into Candango (incremental via syncToken) ---
  private async pullCalendar(userId: string): Promise<void> {
    const conn = await this.connectionFor(userId);
    if (!conn) return;
    const cal = calendarFor(conn);

    // Contact email → personId map, to import only events that involve a known contact.
    const persons = await this.prisma.person.findMany({
      where: { orgId: conn.orgId, deletedAt: null },
      select: { id: true, emails: true },
    });
    const personByEmail = new Map<string, string>();
    for (const p of persons) for (const e of (p.emails as string[]) ?? []) personByEmail.set(e.toLowerCase(), p.id);

    let syncToken = conn.syncToken ?? undefined;
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    for (;;) {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId: 'primary',
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
        pageToken,
      };
      if (syncToken) params.syncToken = syncToken;
      else params.timeMin = new Date(Date.now() - INITIAL_WINDOW_MS).toISOString();

      let res;
      try {
        res = await cal.events.list(params);
      } catch (e) {
        const status = (e as { code?: number; response?: { status?: number } }).code ?? (e as { response?: { status?: number } }).response?.status;
        if (status === 410 && syncToken) {
          // Stored syncToken expired — drop it and do a bounded full resync.
          syncToken = undefined;
          pageToken = undefined;
          await this.prisma.calendarConnection.update({ where: { userId }, data: { syncToken: null } });
          continue;
        }
        throw e;
      }

      for (const ev of res.data.items ?? []) await this.applyInbound(conn, personByEmail, ev);
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    if (nextSyncToken) {
      await this.prisma.calendarConnection.update({ where: { userId }, data: { syncToken: nextSyncToken } });
    }
  }

  private async applyInbound(
    conn: { orgId: string; userId: string },
    personByEmail: Map<string, string>,
    ev: calendar_v3.Schema$Event,
  ): Promise<void> {
    const externalId = ev.id;
    if (!externalId) return;
    const link = await this.prisma.calendarEvent.findFirst({
      where: { orgId: conn.orgId, externalEventId: externalId },
    });

    // Cancelled/deleted in Google → remove the linked activity (if any).
    if (ev.status === 'cancelled') {
      if (link) {
        await this.prisma.calendarEvent.delete({ where: { id: link.id } }).catch(() => undefined);
        await this.prisma.activity.delete({ where: { id: link.activityId } }).catch(() => undefined);
      }
      return;
    }

    const startRaw = ev.start?.dateTime ?? ev.start?.date ?? null;
    const endRaw = ev.end?.dateTime ?? ev.end?.date ?? null;
    const startAt = startRaw ? new Date(startRaw) : null;
    const endAt = endRaw ? new Date(endRaw) : null;
    const subject = ev.summary ?? '(no title)';
    const location = ev.location ?? null;
    const conferenceUrl = ev.hangoutLink ?? null;

    // Known event → reflect Google-side edits onto the linked activity.
    if (link) {
      // Only overwrite conferenceUrl when Google actually has a link — outbound events don't
      // round-trip our manual join URL, so we mustn't null it out.
      const data: Prisma.ActivityUncheckedUpdateInput = { subject, startAt, endAt, location };
      if (conferenceUrl) data.conferenceUrl = conferenceUrl;
      await this.prisma.activity.update({ where: { id: link.activityId }, data }).catch(() => undefined);
      await this.prisma.calendarEvent.update({
        where: { id: link.id },
        data: { etag: ev.etag ?? null, lastSyncedAt: new Date() },
      });
      return;
    }

    // New event on the rep's calendar → import it as a meeting on their Activities calendar.
    // Link to a CRM contact + their open deal when an attendee matches; otherwise import unlinked.
    if (!startAt) return;
    const emails = (ev.attendees ?? [])
      .map((a) => a.email?.toLowerCase())
      .filter((e): e is string => !!e);
    const personId = emails.map((e) => personByEmail.get(e)).find(Boolean) ?? null;
    const dealId = personId ? await this.resolveDeal(conn.orgId, personId) : null;

    await this.prisma.activity.create({
      data: {
        orgId: conn.orgId,
        type: 'meeting',
        subject,
        startAt,
        endAt,
        location,
        conferenceUrl,
        locationType: conferenceUrl ? 'video' : location ? 'in_person' : 'none',
        assignedUserId: conn.userId,
        personId,
        dealId,
        calendarEventId: externalId,
        participants: personId ? { create: [{ personId }] } : undefined,
        calendarEvent: {
          create: {
            orgId: conn.orgId,
            externalEventId: externalId,
            etag: ev.etag ?? null,
            lastSyncedAt: new Date(),
            syncDirection: 'inbound',
          },
        },
      },
    });
  }

  /** Newest open deal the contact is tied to (primary, participant, or via their company). */
  private async resolveDeal(orgId: string, personId: string): Promise<string | null> {
    const deal = await this.prisma.deal.findFirst({
      where: {
        orgId,
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
    return deal?.id ?? null;
  }
}

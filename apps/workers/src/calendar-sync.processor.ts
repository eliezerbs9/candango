import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { calendarFor, tasksFor } from './google.util';

type CalendarSyncJob =
  | { op: 'upsert'; activityId: string }
  | { op: 'delete'; userId: string; kind: 'event' | 'task'; externalId: string };

const firstEmail = (emails: Prisma.JsonValue): string | null => ((emails as string[]) ?? [])[0] ?? null;

/**
 * Syncs an activity to Google: **meetings → Calendar events**, **calls/tasks/emails → Google Tasks**.
 * The Google item's description/notes is filled with the activity details. No-ops when the user
 * isn't connected; throws to trigger BullMQ retries.
 */
@Processor('calendar-sync')
export class CalendarSyncProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async connectionFor(userId: string) {
    const conn = await this.prisma.calendarConnection.findUnique({ where: { userId } });
    return conn && conn.status === 'connected' && conn.refreshToken ? conn : null;
  }

  async process(job: Job<CalendarSyncJob>): Promise<void> {
    if (job.data.op === 'delete') {
      const conn = await this.connectionFor(job.data.userId);
      if (!conn) return;
      if (job.data.kind === 'event') {
        await calendarFor(conn)
          .events.delete({ calendarId: 'primary', eventId: job.data.externalId, sendUpdates: 'none' })
          .catch(() => undefined);
      } else {
        await tasksFor(conn)
          .tasks.delete({ tasklist: '@default', task: job.data.externalId })
          .catch(() => undefined);
      }
      return;
    }

    const { activityId } = job.data;
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
}

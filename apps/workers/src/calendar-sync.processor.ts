import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { calendarFor } from './google.util';

type CalendarSyncJob =
  | { op: 'upsert'; activityId: string }
  | { op: 'delete'; userId: string; externalEventId: string };

const firstEmail = (emails: Prisma.JsonValue): string | null => {
  const list = (emails as string[]) ?? [];
  return list[0] ?? null;
};

/**
 * Pushes a meeting activity to the assignee's Google Calendar (outbound sync, FR-4.2).
 * No-ops when the user hasn't connected Google. Throws to trigger BullMQ retries.
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
    // Self-contained delete (the activity row may already be gone).
    if (job.data.op === 'delete') {
      const conn = await this.connectionFor(job.data.userId);
      if (!conn) return;
      await calendarFor(conn)
        .events.delete({ calendarId: 'primary', eventId: job.data.externalEventId, sendUpdates: 'none' })
        .catch(() => undefined);
      return;
    }

    const { activityId } = job.data;
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { participants: { include: { person: true } }, calendarEvent: true },
    });
    if (!activity?.assignedUserId) return;

    const conn = await this.connectionFor(activity.assignedUserId);
    if (!conn) return; // not connected → skip
    const cal = calendarFor(conn);

    // Only meetings with a start time go to the calendar.
    if (activity.type !== 'meeting' || !activity.startAt) return;

    const attendees = activity.participants
      .map((p) => firstEmail(p.person.emails))
      .filter((e): e is string => !!e)
      .map((email) => ({ email }));

    const requestBody = {
      summary: activity.subject,
      start: { dateTime: activity.startAt.toISOString() },
      end: { dateTime: (activity.endAt ?? activity.startAt).toISOString() },
      location: activity.locationType === 'in_person' ? (activity.location ?? undefined) : undefined,
      description:
        activity.locationType === 'video' && activity.conferenceUrl
          ? `Join: ${activity.conferenceUrl}`
          : undefined,
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
        where: { activityId },
        data: { etag: res.data.etag ?? null, lastSyncedAt: new Date(), syncDirection: 'outbound' },
      });
    } else {
      const res = await cal.events.insert({ calendarId: 'primary', requestBody, sendUpdates: 'none' });
      const externalEventId = res.data.id;
      if (!externalEventId) throw new Error('Google did not return an event id');
      await this.prisma.calendarEvent.create({
        data: {
          orgId: activity.orgId,
          activityId,
          externalEventId,
          etag: res.data.etag ?? null,
          lastSyncedAt: new Date(),
          syncDirection: 'outbound',
        },
      });
      await this.prisma.activity.update({ where: { id: activityId }, data: { calendarEventId: externalEventId } });
    }
  }
}

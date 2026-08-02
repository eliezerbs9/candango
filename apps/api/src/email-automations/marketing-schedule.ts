/**
 * Marketing-automation scheduling (FR-16.x). Pure, timezone-aware date math — no DB, no side
 * effects — so it can be unit-tested and shared by the CRUD (validation + first nextRunAt) and the
 * scanner (advance nextRunAt after each fire). All `atTime` values are wall-clock times in the
 * automation's IANA `timezone`; we resolve them to UTC instants with the platform's Intl data.
 *
 * Supported schedule types (all approved for the marketing feature):
 *  - daily            — every N days at a time
 *  - weekly           — on chosen weekdays, optionally every N weeks
 *  - monthly_date     — on a day-of-month (clamped to the last day of short months)
 *  - monthly_weekday  — on the Nth weekday of the month (e.g. 2nd Tuesday; week 'last' = last one)
 *  - once             — a single date + time
 */

export type ScheduleType = 'daily' | 'weekly' | 'monthly_date' | 'monthly_weekday' | 'once';
export const SCHEDULE_TYPES: ScheduleType[] = ['daily', 'weekly', 'monthly_date', 'monthly_weekday', 'once'];

export interface MarketingSchedule {
  type: ScheduleType;
  /** 'HH:MM' 24h wall-clock time in the automation timezone (all types except when using once.date). */
  atTime?: string;
  everyDays?: number; // daily (default 1)
  daysOfWeek?: number[]; // weekly: 0=Sun … 6=Sat
  everyWeeks?: number; // weekly (default 1)
  dayOfMonth?: number; // monthly_date: 1..31 (clamped)
  week?: number | 'last'; // monthly_weekday: 1..5 or 'last'
  weekday?: number; // monthly_weekday: 0=Sun … 6=Sat
  date?: string; // once: 'YYYY-MM-DD'
}

const DAY_MS = 86_400_000;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Milliseconds to add to a UTC instant to get local wall-clock time in `tz` (i.e. local = utc + offset). */
function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  // `hour` can come back as '24' at midnight in some engines — normalise to 0.
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return asUtc - date.getTime();
}

/** Resolve a wall-clock time in `tz` to the corresponding UTC instant (DST-correct via a second pass). */
function wallToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  let utc = naive - tzOffsetMs(tz, new Date(naive));
  utc = naive - tzOffsetMs(tz, new Date(utc)); // correct around DST transitions
  return new Date(utc);
}

interface LocalParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  weekday: number; // 0=Sun … 6=Sat
}

/** The local calendar parts of a UTC instant in `tz`. */
function localParts(tz: string, date: Date): LocalParts {
  const local = new Date(date.getTime() + tzOffsetMs(tz, date));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

/** A monotonically increasing day number for a calendar date (for interval/week math). */
const dayNumber = (y: number, mo: number, d: number) => Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS);
const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();

/** Day-of-month for the Nth (or last) `weekday` of a month, or null if it doesn't exist. */
function nthWeekdayOfMonth(y: number, mo: number, week: number | 'last', weekday: number): number | null {
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const firstMatch = 1 + ((weekday - first + 7) % 7); // day-of-month of the first matching weekday
  if (week === 'last') {
    let d = firstMatch;
    while (d + 7 <= daysInMonth(y, mo)) d += 7;
    return d;
  }
  const d = firstMatch + (week - 1) * 7;
  return d <= daysInMonth(y, mo) ? d : null;
}

function parseTime(atTime: string | undefined): { h: number; mi: number } {
  const [h, mi] = (atTime ?? '09:00').split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 9, mi: Number.isFinite(mi) ? mi : 0 };
}

/**
 * The next UTC instant this schedule fires strictly after `after`, or null if it never fires again
 * (a past one-time send). `anchor` seeds interval counting for daily/every-N-weeks (use the
 * automation's start date); it defaults to `after`.
 */
export function computeNextRun(
  schedule: MarketingSchedule,
  timezone: string,
  after: Date,
  anchor?: Date,
): Date | null {
  const tz = timezone || 'UTC';
  const { h, mi } = parseTime(schedule.atTime);

  if (schedule.type === 'once') {
    if (!schedule.date) return null;
    const [y, mo, d] = schedule.date.split('-').map(Number);
    const at = wallToUtc(tz, y, mo, d, h, mi);
    return at.getTime() > after.getTime() ? at : null;
  }

  const anchorLocal = localParts(tz, anchor ?? after);
  const anchorNum = dayNumber(anchorLocal.year, anchorLocal.month, anchorLocal.day);
  const start = localParts(tz, after);

  // Walk forward day by day from `after`'s local date, up to ~2.5 years, and return the first match.
  for (let offset = 0; offset < 900; offset++) {
    const base = new Date(Date.UTC(start.year, start.month - 1, start.day) + offset * DAY_MS);
    const y = base.getUTCFullYear();
    const mo = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    const weekday = base.getUTCDay();
    const num = dayNumber(y, mo, d);

    let matches = false;
    switch (schedule.type) {
      case 'daily': {
        const every = Math.max(1, schedule.everyDays ?? 1);
        matches = num >= anchorNum && (num - anchorNum) % every === 0;
        break;
      }
      case 'weekly': {
        const days = schedule.daysOfWeek?.length ? schedule.daysOfWeek : [anchorLocal.weekday];
        if (days.includes(weekday)) {
          const every = Math.max(1, schedule.everyWeeks ?? 1);
          const weekIdx = Math.floor((num - anchorNum) / 7);
          matches = num >= anchorNum && weekIdx % every === 0;
        }
        break;
      }
      case 'monthly_date': {
        const target = Math.min(Math.max(1, schedule.dayOfMonth ?? 1), daysInMonth(y, mo));
        matches = d === target;
        break;
      }
      case 'monthly_weekday': {
        const target = nthWeekdayOfMonth(y, mo, schedule.week ?? 1, schedule.weekday ?? 0);
        matches = target != null && d === target;
        break;
      }
    }
    if (!matches) continue;

    const fire = wallToUtc(tz, y, mo, d, h, mi);
    if (fire.getTime() > after.getTime()) return fire;
  }
  return null;
}

/** A short human summary of a schedule (for the automations list). */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
export function describeSchedule(schedule: MarketingSchedule): string {
  const at = schedule.atTime ?? '09:00';
  switch (schedule.type) {
    case 'daily': {
      const n = Math.max(1, schedule.everyDays ?? 1);
      return n === 1 ? `every day at ${at}` : `every ${n} days at ${at}`;
    }
    case 'weekly': {
      const days = (schedule.daysOfWeek ?? []).map((d) => WD[d]).join(', ') || 'the same weekday';
      const every = Math.max(1, schedule.everyWeeks ?? 1);
      return every === 1 ? `weekly on ${days} at ${at}` : `every ${every} weeks on ${days} at ${at}`;
    }
    case 'monthly_date':
      return `monthly on day ${schedule.dayOfMonth ?? 1} at ${at}`;
    case 'monthly_weekday': {
      const wk = schedule.week === 'last' ? 'last' : ORD[Number(schedule.week ?? 1)] || '1st';
      return `monthly on the ${wk} ${WD[schedule.weekday ?? 0]} at ${at}`;
    }
    case 'once':
      return `once on ${schedule.date ?? '—'} at ${at}`;
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate a schedule config; returns an error string or null if OK. */
export function validateSchedule(s: MarketingSchedule, timezone: string): string | null {
  if (!SCHEDULE_TYPES.includes(s.type)) return 'Unknown schedule type';
  if (!timezone) return 'A timezone is required';
  try {
    // Throws for an unknown IANA zone.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return 'Invalid timezone';
  }
  if (s.type === 'once') {
    if (!s.date || !DATE_RE.test(s.date)) return 'Pick a date';
  }
  if (s.atTime && !TIME_RE.test(s.atTime)) return 'Time must be HH:MM';
  if (s.type === 'daily' && s.everyDays != null && (s.everyDays < 1 || s.everyDays > 365)) return 'Every N days must be 1–365';
  if (s.type === 'weekly') {
    if (!s.daysOfWeek?.length) return 'Pick at least one weekday';
    if (s.daysOfWeek.some((d) => d < 0 || d > 6)) return 'Invalid weekday';
    if (s.everyWeeks != null && (s.everyWeeks < 1 || s.everyWeeks > 52)) return 'Every N weeks must be 1–52';
  }
  if (s.type === 'monthly_date' && (s.dayOfMonth == null || s.dayOfMonth < 1 || s.dayOfMonth > 31)) return 'Day of month must be 1–31';
  if (s.type === 'monthly_weekday') {
    if (s.week !== 'last' && (Number(s.week) < 1 || Number(s.week) > 5)) return 'Week must be 1–5 or last';
    if (s.weekday == null || s.weekday < 0 || s.weekday > 6) return 'Pick a weekday';
  }
  return null;
}

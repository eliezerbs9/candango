import type { MarketingAudience, MarketingSchedule } from './api/email-automations';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];

/** Short human summary of a marketing schedule (mirror of the API's describeSchedule). */
export function describeSchedule(s: MarketingSchedule): string {
  const at = s.atTime ?? '09:00';
  switch (s.type) {
    case 'daily': {
      const n = Math.max(1, s.everyDays ?? 1);
      return n === 1 ? `every day at ${at}` : `every ${n} days at ${at}`;
    }
    case 'weekly': {
      const days = (s.daysOfWeek ?? []).map((d) => WD[d]).join(', ') || 'the same weekday';
      const every = Math.max(1, s.everyWeeks ?? 1);
      return every === 1 ? `weekly on ${days} at ${at}` : `every ${every} weeks on ${days} at ${at}`;
    }
    case 'monthly_date':
      return `monthly on day ${s.dayOfMonth ?? 1} at ${at}`;
    case 'monthly_weekday': {
      const wk = s.week === 'last' ? 'last' : ORD[Number(s.week ?? 1)] || '1st';
      return `monthly on the ${wk} ${WD[s.weekday ?? 0]} at ${at}`;
    }
    case 'once':
      return `once on ${s.date ?? '—'} at ${at}`;
  }
}

/** Short human summary of a marketing audience. */
export function describeAudience(a: MarketingAudience): string {
  switch (a.type) {
    case 'label':
      return `contacts labelled ${(a.tags ?? []).join(', ')}`;
    case 'deal_stage':
      return 'contacts with a deal in the chosen stage';
    case 'all':
      return 'all subscribed contacts';
    case 'filter':
      return 'contacts matching a filter';
  }
}

/**
 * Marketing-automation audiences (FR-16.x). Pure types + validation; the DB resolution lives in the
 * service (resolveAudience). Every audience is implicitly restricted to contacts who are subscribed
 * to marketing email AND have an email address — opt-out is enforced there, not here.
 *
 *  - label       — contacts carrying ANY of the given labels/tags
 *  - deal_stage  — contacts on a deal currently in a given pipeline stage
 *  - all         — all subscribed contacts
 *  - filter      — a small builder: labels (any/all) optionally scoped to a company
 */

export type AudienceType = 'label' | 'deal_stage' | 'all' | 'filter';
export const AUDIENCE_TYPES: AudienceType[] = ['label', 'deal_stage', 'all', 'filter'];

export interface MarketingAudience {
  type: AudienceType;
  tags?: string[]; // label: match any of these
  stageId?: string; // deal_stage
  filter?: {
    tagsAny?: string[];
    tagsAll?: string[];
    companyId?: string;
  };
}

export function validateAudience(a: MarketingAudience): string | null {
  if (!AUDIENCE_TYPES.includes(a.type)) return 'Unknown audience type';
  if (a.type === 'label' && !a.tags?.length) return 'Pick at least one label';
  if (a.type === 'deal_stage' && !a.stageId) return 'Pick a stage';
  if (a.type === 'filter') {
    const f = a.filter;
    if (!f || (!f.tagsAny?.length && !f.tagsAll?.length && !f.companyId)) return 'Add at least one filter rule';
  }
  return null;
}

export function describeAudience(a: MarketingAudience): string {
  switch (a.type) {
    case 'label':
      return `contacts labelled ${(a.tags ?? []).join(', ')}`;
    case 'deal_stage':
      return 'contacts with a deal in the chosen stage';
    case 'all':
      return 'all subscribed contacts';
    case 'filter': {
      const parts: string[] = [];
      if (a.filter?.tagsAny?.length) parts.push(`any of ${a.filter.tagsAny.join(', ')}`);
      if (a.filter?.tagsAll?.length) parts.push(`all of ${a.filter.tagsAll.join(', ')}`);
      if (a.filter?.companyId) parts.push('at a company');
      return `contacts matching ${parts.join(' + ') || 'a filter'}`;
    }
  }
}

/**
 * Email-automation triggers (FR-16.3). Each automation picks one trigger + a template; when the
 * trigger fires, the template is rendered against the deal and sent. Event-driven triggers run via
 * an @OnEvent('webhook.event') listener; time-based triggers (overdue / follow-up) run from a
 * scheduled worker. `config` fields are trigger-specific (see `fields`). Single source of truth —
 * mirror the keys/labels in the web automations UI.
 */

export type TriggerKind = 'event' | 'time';

export interface TriggerConfigField {
  key: string;
  label: string;
  type: 'stage' | 'docKind' | 'days';
  required?: boolean;
}

export interface TriggerDef {
  key: string;
  label: string;
  description: string;
  kind: TriggerKind;
  /** Domain event `type`(s) that fire this trigger (for event kinds). */
  events?: string[];
  fields: TriggerConfigField[];
  /** Not yet wired to fire — shown but not selectable. */
  comingSoon?: boolean;
}

export const AUTOMATION_TRIGGERS: TriggerDef[] = [
  {
    key: 'deal_stage_changed',
    label: 'Deal enters a stage',
    description: 'When a deal moves into the selected pipeline stage (or any stage, if none chosen).',
    kind: 'event',
    events: ['deal.stage_changed'],
    fields: [{ key: 'stageId', label: 'Stage', type: 'stage' }],
  },
  {
    key: 'deal_won',
    label: 'Deal won',
    description: 'When a deal is marked won.',
    kind: 'event',
    events: ['deal.won'],
    fields: [],
  },
  {
    key: 'deal_lost',
    label: 'Deal lost',
    description: 'When a deal is marked lost.',
    kind: 'event',
    events: ['deal.lost'],
    fields: [],
  },
  {
    key: 'doc_sent',
    label: 'Estimate/invoice sent',
    description: 'When an estimate or invoice is sent to the customer.',
    kind: 'event',
    events: ['deal.doc_sent'],
    fields: [{ key: 'docKind', label: 'Document', type: 'docKind' }],
  },
  {
    key: 'follow_up',
    label: 'Deal sits in a stage for N days',
    description: 'When an open deal has been in the chosen stage (or any stage) for the given number of days — a follow-up nudge. Checked daily.',
    kind: 'time',
    fields: [
      { key: 'stageId', label: 'In stage', type: 'stage' },
      { key: 'afterDays', label: 'For this many days', type: 'days', required: true },
    ],
  },
  {
    key: 'proposal_accepted',
    label: 'Proposal accepted',
    description: 'When a customer accepts a proposal from its presentation link.',
    kind: 'event',
    events: ['proposal.accepted'],
    fields: [],
  },
  {
    key: 'document_signed',
    label: 'Document signed',
    description: 'When a customer completes an e-signature request.',
    kind: 'event',
    events: ['document.signed'],
    fields: [],
  },
  {
    key: 'doc_overdue',
    label: 'Estimate/invoice overdue',
    description: 'A set number of days after an estimate/invoice was sent without being accepted/paid.',
    kind: 'time',
    comingSoon: true,
    fields: [
      { key: 'docKind', label: 'Document', type: 'docKind' },
      { key: 'afterDays', label: 'Days after sent', type: 'days', required: true },
    ],
  },
];

export const TRIGGER_KEYS = AUTOMATION_TRIGGERS.map((t) => t.key);
export const triggerDef = (key: string) => AUTOMATION_TRIGGERS.find((t) => t.key === key);

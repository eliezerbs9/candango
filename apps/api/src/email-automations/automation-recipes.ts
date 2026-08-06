/**
 * Pre-built "starter kit" automations. Each recipe belongs to a GROUP that seeds at most once per org
 * (tracked in Organization.seededAutomationGroups): `core` (no integration), `gmail` (needs a connected
 * mailbox — brings its own deal email template), `quickbooks` (added in the dedicated QB pass — none yet).
 * Recipes only reference things a fresh org has (no stage/document ids): activity/tag/email actions.
 */

export type RecipeGroup = 'core' | 'gmail' | 'quickbooks';

export interface RecipeTemplate {
  systemKey: string; // upserted per org, so a re-seed reuses (and never overwrites) it
  name: string;
  subject: string;
  body: string; // richtext HTML with {{variables}} (deal scope)
}

export interface StarterRecipe {
  key: string;
  group: RecipeGroup;
  name: string;
  category: string; // AUTOMATION_CATEGORY key
  trigger: string;
  action: string;
  config?: Record<string, unknown>;
  template?: RecipeTemplate; // send_email recipes bring the template to create
}

export const STARTER_RECIPES: StarterRecipe[] = [
  // ── Core (work without any integration) ───────────────────────────────
  {
    key: 'core_won_kickoff',
    group: 'core',
    name: 'New win → schedule kickoff',
    category: 'onboarding',
    trigger: 'deal_won',
    action: 'create_activity',
    config: { activityType: 'task', activitySubject: 'Schedule kickoff with {{contact.first_name}}', dueInDays: 2 },
  },
  {
    key: 'core_signed_tag',
    group: 'core',
    name: 'Signed → tag the contact as customer',
    category: 'onboarding',
    trigger: 'document_signed',
    action: 'add_tag',
    config: { tag: 'customer' },
  },
  {
    key: 'core_signed_onboard',
    group: 'core',
    name: 'Signed → create onboarding task',
    category: 'onboarding',
    trigger: 'document_signed',
    action: 'create_activity',
    config: { activityType: 'task', activitySubject: 'Onboard {{company.name or contact.name}}', dueInDays: 1 },
  },
  {
    key: 'core_declined_followup',
    group: 'core',
    name: 'Proposal declined → follow-up call',
    category: 'sales',
    trigger: 'proposal_declined',
    action: 'create_activity',
    config: { activityType: 'call', activitySubject: 'Follow up on declined proposal', dueInDays: 3 },
  },
  {
    key: 'core_lost_winback',
    group: 'core',
    name: 'Deal lost → win-back reminder (90 days)',
    category: 'sales',
    trigger: 'deal_lost',
    action: 'create_activity',
    config: { activityType: 'task', activitySubject: 'Win-back check-in with {{contact.first_name}}', dueInDays: 90 },
  },

  // ── Gmail (need a connected mailbox; each brings a deal email template) ─
  {
    key: 'gmail_signed_thanks',
    group: 'gmail',
    name: 'Signed → thank-you email',
    category: 'onboarding',
    trigger: 'document_signed',
    action: 'send_email',
    template: {
      systemKey: 'auto_thanks_signed',
      name: 'Thanks — document signed',
      subject: 'Thank you, {{contact.first_name}}!',
      body: '<p>Hi {{contact.first_name}},</p><p>Thank you for signing — we’re excited to get started with {{company.name or contact.name}}. We’ll be in touch shortly with the next steps.</p><p>Best,<br>{{sender.name}}</p>',
    },
  },
  {
    key: 'gmail_accepted_next',
    group: 'gmail',
    name: 'Proposal accepted → next-steps email',
    category: 'sales',
    trigger: 'proposal_accepted',
    action: 'send_email',
    template: {
      systemKey: 'auto_proposal_accepted',
      name: 'Proposal accepted — next steps',
      subject: 'Great news — let’s get started',
      body: '<p>Hi {{contact.first_name}},</p><p>Thanks for accepting the proposal! Next, we’ll send the agreement to sign and then kick things off.</p><p>Best,<br>{{sender.name}}</p>',
    },
  },
  {
    key: 'gmail_declined_keepintouch',
    group: 'gmail',
    name: 'Proposal declined → keep-in-touch email',
    category: 'sales',
    trigger: 'proposal_declined',
    action: 'send_email',
    template: {
      systemKey: 'auto_proposal_declined',
      name: 'Proposal declined — keep in touch',
      subject: 'Thanks for considering us',
      body: '<p>Hi {{contact.first_name}},</p><p>Thanks for taking the time to review our proposal. If anything changes or we can help down the line, we’re here.</p><p>Best,<br>{{sender.name}}</p>',
    },
  },
];

/** Groups that actually have recipes today (quickbooks is defined but empty until the QB pass). */
export const RECIPE_GROUPS_WITH_RECIPES = Array.from(new Set(STARTER_RECIPES.map((r) => r.group)));

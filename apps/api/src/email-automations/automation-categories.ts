/**
 * System-defined automation categories (FR-16.x). Users choose one per automation and can filter by
 * it, but they CANNOT create new categories — the set is fixed here. Freeform `tags` cover the
 * open-ended labelling need. Single source of truth — mirror the keys/labels in the web UI.
 */
export interface AutomationCategory {
  key: string;
  label: string;
  description: string;
}

export const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  { key: 'general', label: 'General', description: 'Uncategorised automations.' },
  { key: 'sales', label: 'Sales', description: 'Deal-stage nudges, follow-ups and pipeline hygiene.' },
  { key: 'marketing', label: 'Marketing', description: 'Broadcasts and campaigns to an audience of contacts.' },
  { key: 'onboarding', label: 'Onboarding', description: 'Welcoming and activating new customers.' },
  { key: 'support', label: 'Support', description: 'Post-sale check-ins and service touchpoints.' },
];

export const AUTOMATION_CATEGORY_KEYS = AUTOMATION_CATEGORIES.map((c) => c.key);
export const isAutomationCategory = (key: string) => AUTOMATION_CATEGORY_KEYS.includes(key);

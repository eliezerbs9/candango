/**
 * Built-in fields shown on the Fields settings page alongside user-defined custom fields. These are
 * NOT stored as CustomFieldDefinition rows — they're the record's real columns (core) or values
 * surfaced by an integration (integration). They can't be edited or deleted. Single source of truth
 * for the "essential fields" catalog per entity.
 */
export interface SystemField {
  key: string;
  label: string;
  type: string;
  group: 'core' | 'integration';
  integration?: 'quickbooks';
}

export const SYSTEM_FIELDS: Record<string, SystemField[]> = {
  person: [
    { key: 'name', label: 'Full name', type: 'text', group: 'core' },
    { key: 'email', label: 'Email', type: 'text', group: 'core' },
    { key: 'phone', label: 'Phone', type: 'text', group: 'core' },
    { key: 'companies', label: 'Companies', type: 'company', group: 'core' },
    { key: 'owner', label: 'Owner', type: 'user', group: 'core' },
    { key: 'tags', label: 'Labels', type: 'text', group: 'core' },
    { key: 'emailSubscribed', label: 'Marketing subscription', type: 'boolean', group: 'core' },
  ],
  company: [
    { key: 'name', label: 'Name', type: 'text', group: 'core' },
    { key: 'domain', label: 'Domain', type: 'text', group: 'core' },
    { key: 'email', label: 'Email', type: 'text', group: 'core' },
    { key: 'phone', label: 'Phone', type: 'text', group: 'core' },
    { key: 'contacts', label: 'Contacts', type: 'people', group: 'core' },
    { key: 'primaryContact', label: 'Primary contact', type: 'person', group: 'core' },
    { key: 'owner', label: 'Owner', type: 'user', group: 'core' },
    { key: 'tags', label: 'Labels', type: 'text', group: 'core' },
  ],
  deal: [
    { key: 'title', label: 'Title', type: 'text', group: 'core' },
    { key: 'refNumber', label: 'Deal number', type: 'number', group: 'core' },
    { key: 'value', label: 'Value', type: 'number', group: 'core' },
    { key: 'currency', label: 'Currency', type: 'text', group: 'core' },
    { key: 'pipeline', label: 'Pipeline', type: 'text', group: 'core' },
    { key: 'stage', label: 'Stage', type: 'text', group: 'core' },
    { key: 'owner', label: 'Owner', type: 'user', group: 'core' },
    { key: 'company', label: 'Company', type: 'company', group: 'core' },
    { key: 'primaryPerson', label: 'Primary contact', type: 'person', group: 'core' },
    { key: 'participants', label: 'Participants', type: 'people', group: 'core' },
    { key: 'tags', label: 'Labels', type: 'text', group: 'core' },
    { key: 'status', label: 'Status', type: 'text', group: 'core' },
    { key: 'expectedCloseDate', label: 'Expected close date', type: 'date', group: 'core' },
  ],
};

/**
 * Integration-owned fields (shown only when the integration is connected).
 * NOTE: the deal's Ship To / Bill To are deliberately NOT surfaced here — they are internal-only
 * addresses managed on the Estimates tab, not part of the user-facing Fields catalog.
 */
export const INTEGRATION_FIELDS: Record<string, SystemField[]> = {
  person: [
    { key: 'qbCustomerId', label: 'QuickBooks customer ID', type: 'text', group: 'integration', integration: 'quickbooks' },
  ],
  company: [
    { key: 'qbCustomerId', label: 'QuickBooks customer ID', type: 'text', group: 'integration', integration: 'quickbooks' },
  ],
  deal: [
    { key: 'qbSubcustomerId', label: 'QuickBooks sub-customer ID', type: 'text', group: 'integration', integration: 'quickbooks' },
  ],
};

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'image', 'document', 'address', 'person', 'company'] as const;

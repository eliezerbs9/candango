// Shapes returned by the Candango API (mirror of the Prisma models we expose).

export interface ApiPipeline {
  id: string;
  name: string;
  isDefault: boolean;
  position: number;
}

export interface ApiStage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  probability: number;
  rottingDays: number | null;
}

export type DealStatus = 'open' | 'won' | 'lost';

export interface ApiDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  pipelineId: string;
  stageId: string;
  ownerUserId: string;
  primaryPersonId: string | null;
  companyId: string | null;
  status: DealStatus;
  lostReason: string | null;
  expectedCloseDate: string | null;
  stageChangedAt: string;
  tags: string[];
  customFields: Record<string, unknown>;
  shipTo: Address | null;
  billTo: Address | null;
  qbSubcustomerId: string | null;
  refNumber: number | null;
  archivedAt: string | null;
  createdAt: string;
  /** Latest activity timestamp (for the pipeline card) — present on the board/list response. */
  lastActivityAt: string | null;
}

/** Which elements show on a pipeline deal card (workspace-configurable). */
export interface DealCardConfig {
  company?: boolean;
  primaryContact?: boolean;
  value?: boolean;
  owner?: boolean;
  daysInStage?: boolean;
  created?: boolean;
  lastActivity?: boolean;
  tags?: boolean;
}

/** Defaults when a workspace hasn't customised the card (matches the pre-config layout). */
export const DEAL_CARD_DEFAULTS: DealCardConfig = {
  company: true,
  primaryContact: true,
  value: true,
  owner: false,
  daysInStage: false,
  created: false,
  lastActivity: false,
  tags: false,
};

/** Merge a stored (possibly empty) config over the defaults. */
export function resolveDealCard(cfg: DealCardConfig | undefined | null): Required<DealCardConfig> {
  return { ...DEAL_CARD_DEFAULTS, ...(cfg ?? {}) } as Required<DealCardConfig>;
}

export type DocSource = 'native' | 'quickbooks';

export interface DealDocLine {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number; // minor units
  amount: number; // minor units
  itemId: string | null;
  itemName: string | null;
}

export interface DealDoc {
  id: string;
  dealId: string;
  source: DocSource;
  status: string;
  docNumber: string | null;
  currency: string;
  totalAmount: number; // minor units
  txnDate: string | null;
  notes: string | null;
  qbId: string | null;
  sourceEstimateId: string | null;
  sourceEstimateIds?: string[];
  includeInValue?: boolean;
  taxRateBps?: number; // tax rate applied to a local doc, basis points (0 = none)
  createdAt: string;
  lines: DealDocLine[];
}

export interface ConvertToInvoiceInput {
  estimateIds: string[];
  memo?: string;
  txnDate?: string;
  status?: string;
}

export interface DocLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number; // minor units
  itemId?: string;
}

export interface CreateDocInput {
  txnDate?: string;
  notes?: string;
  lines: DocLineInput[];
  sourceEstimateId?: string;
  // On estimate create: `setAsValue` makes it the sole deal-value estimate;
  // `includeInValue` adds it to the value (sum). Omitted = don't count (FR-13.11).
  includeInValue?: boolean;
  setAsValue?: boolean;
  taxRateBps?: number; // local docs only; QBO computes its own tax
  applyTax?: boolean; // QBO docs: make the doc taxable so QuickBooks computes sales tax
}

export interface QbCustomer {
  id: string;
  name: string;
}

export interface Address {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export type QbItem = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitPrice?: number | null;
  taxable?: boolean;
};

export interface QbLinkStatus {
  linked: boolean;
  clientHasParent: boolean;
  clientName: string | null;
}

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
  customFields: Record<string, unknown>;
  shipTo: Address | null;
  billTo: Address | null;
  qbSubcustomerId: string | null;
  refNumber: number | null;
  archivedAt: string | null;
}

export type DocSource = 'native' | 'quickbooks';

export interface DealDocLine {
  id: string;
  position: number;
  description: string;
  quantity: number;
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
  unitPrice: number; // minor units
  itemId?: string;
}

export interface CreateDocInput {
  txnDate?: string;
  notes?: string;
  lines: DocLineInput[];
  sourceEstimateId?: string;
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

export type QbItem = { id: string; name: string };

export interface QbLinkStatus {
  linked: boolean;
  clientHasParent: boolean;
  clientName: string | null;
}

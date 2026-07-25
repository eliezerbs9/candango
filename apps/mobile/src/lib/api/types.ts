// Shapes returned by the Candango API (mirror of apps/web/lib/api/types.ts +
// contacts.ts — only the fields the mobile app needs).

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

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
  value: number; // minor units (cents)
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
  refNumber: number | null;
  archivedAt: string | null;
}

export interface ContactRef {
  id: string;
  name: string;
}

export interface ApiPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: Address | null;
  companies: ContactRef[];
}

export interface ApiCompany {
  id: string;
  name: string;
  domain: string | null;
  address: Address | null;
  phone: string | null;
  contacts: ContactRef[];
}

export type ActivityType = 'call' | 'meeting' | 'task' | 'email';
export type LocationType = 'in_person' | 'video' | 'phone' | 'none';

export interface ApiActivity {
  id: string;
  type: ActivityType;
  subject: string;
  dueAt: string | null; // call/task/email
  startAt: string | null; // meeting
  endAt: string | null; // meeting
  location: string | null;
  locationType: LocationType | null;
  conferenceUrl: string | null;
  done: boolean;
  dealId: string | null;
  personId: string | null;
  assignedUserId: string | null;
  participants: ContactRef[];
  createdAt: string;
}

export interface ActivityBody {
  type: ActivityType;
  subject: string;
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  dealId?: string;
}

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ApiDeal } from '@/lib/api/types';
import type { Address } from '@/components/deals/AddressFields';

export interface DealForm {
  title: string;
  value: number | string;
  companyId: string | null;
  primaryPersonId: string | null;
  expectedCloseDate: string;
  shipTo: Address;
  billTo: Address;
  customFields: Record<string, unknown>;
}

/** Shared deal + editable form + save, provided by the deal layout so every sub-route page can use it. */
export interface DealCtxValue {
  deal: ApiDeal;
  form: DealForm;
  setForm: (f: DealForm) => void;
  save: () => void;
  saving: boolean;
  /** A compact right-aligned "Save changes" bar — the whole deal saves from any tab. */
  saveBar: ReactNode;
}

const DealContext = createContext<DealCtxValue | null>(null);

export function DealProvider({ value, children }: { value: DealCtxValue; children: ReactNode }) {
  return <DealContext.Provider value={value}>{children}</DealContext.Provider>;
}

export function useDealCtx(): DealCtxValue {
  const ctx = useContext(DealContext);
  if (!ctx) throw new Error('useDealCtx must be used within the deal layout');
  return ctx;
}

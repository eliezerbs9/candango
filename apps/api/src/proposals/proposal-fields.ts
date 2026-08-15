/**
 * Internal (rep-filled, client-hidden) fields defined on a proposal template and snapshotted onto a
 * proposal. They never render on the client-facing page; their purpose is to feed automations
 * (e.g. a required `signature_template` field the rep attaches, sent for signature on accept).
 */
export type ProposalFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'image'
  | 'document'
  | 'signature_template'
  | 'estimate'
  | 'invoice';

export interface ProposalFieldDef {
  key: string;
  label: string;
  type: ProposalFieldType;
  required?: boolean;
  options?: string[]; // for `select`
  /** For `document`/`image` fields: the deal custom-field key this binds to (value lives on the deal, not the proposal). */
  customFieldKey?: string;
  /** For file (`document`/`image`) and pricing (`estimate`/`invoice`) fields: allow more than one (default true). `false` = exactly one. */
  multiple?: boolean;
}

/** Field types whose "value" is a countable set (files, or estimates/invoices in pricing). */
export const COUNTABLE_TYPES: ProposalFieldType[] = ['document', 'image', 'estimate', 'invoice'];

const TYPES: ProposalFieldType[] = ['text', 'number', 'date', 'select', 'image', 'document', 'signature_template', 'estimate', 'invoice'];

/** Coerce raw JSON (from the client) into a clean, de-duplicated list of field defs. */
export function normalizeProposalFields(raw: unknown): ProposalFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposalFieldDef[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    const key = typeof o?.key === 'string' ? o.key.trim() : '';
    const label = typeof o?.label === 'string' ? o.label.trim() : '';
    const type = TYPES.includes(o?.type as ProposalFieldType) ? (o.type as ProposalFieldType) : 'text';
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label,
      type,
      required: !!o?.required,
      ...(type === 'select' && Array.isArray(o?.options) ? { options: (o.options as unknown[]).map(String) } : {}),
      ...((type === 'document' || type === 'image') && typeof o?.customFieldKey === 'string' && o.customFieldKey
        ? { customFieldKey: o.customFieldKey }
        : {}),
      ...(COUNTABLE_TYPES.includes(type) && typeof o?.multiple === 'boolean' ? { multiple: o.multiple } : {}),
    });
  }
  return out;
}

/** A field value counts as "empty" when unset, blank string, or empty array. */
export function isFieldValueBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Everything needed to evaluate a field's fill state at send time. */
export interface ProposalGateContext {
  fieldValues: Record<string, unknown>;
  dealCustomFields: Record<string, unknown>;
  /** All estimate/invoice ids the proposal references (pricing elements ∪ estimate/invoice fields ∪ legacy). */
  estimateIds: string[];
  invoiceIds: string[];
}

/** Estimate/invoice ids a proposal references: pricing element docs ∪ the estimate/invoice field values ∪ legacy `estimateIds`. */
export function collectProposalPricingIds(
  fields: ProposalFieldDef[],
  fieldValues: Record<string, unknown>,
  pricing: { estimateIds: string[]; invoiceIds: string[] },
  legacyEstimateIds: string[] = [],
): { estimateIds: string[]; invoiceIds: string[] } {
  const estimate = new Set<string>([...pricing.estimateIds, ...legacyEstimateIds]);
  const invoice = new Set<string>(pricing.invoiceIds);
  for (const f of fields) {
    if (f.type !== 'estimate' && f.type !== 'invoice') continue;
    const raw = fieldValues?.[f.key];
    const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
    for (const id of ids) (f.type === 'estimate' ? estimate : invoice).add(id);
  }
  return { estimateIds: [...estimate], invoiceIds: [...invoice] };
}

/** Object keys held by a deal image/document custom field (image = string[], document = {key}[]). */
export function dealFileKeys(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : (x as { key?: string })?.key)).filter((k): k is string => !!k);
}

/** How many items a field holds (files, pricing docs, or 0/1 for a scalar). */
export function proposalFieldCount(field: ProposalFieldDef, ctx: ProposalGateContext): number {
  if (field.type === 'estimate') return ctx.estimateIds.length;
  if (field.type === 'invoice') return ctx.invoiceIds.length;
  if (field.type === 'document' || field.type === 'image') {
    // The deal keeps ALL its files; the proposal stores which are LINKED (keys in `fieldValues`).
    const keys = field.customFieldKey ? dealFileKeys(ctx.dealCustomFields?.[field.customFieldKey]) : [];
    const sel = ctx.fieldValues?.[field.key];
    if (field.multiple === false) {
      return typeof sel === 'string' && keys.includes(sel) ? 1 : 0;
    }
    const selKeys = Array.isArray(sel) ? (sel as unknown[]).filter((k): k is string => typeof k === 'string' && keys.includes(k)) : [];
    return selKeys.length;
  }
  return isFieldValueBlank(ctx.fieldValues?.[field.key]) ? 0 : 1;
}

/**
 * Reasons a proposal can't be sent yet: required fields unfilled, or a single-limit field (files or
 * pricing docs) that holds more than one. Empty ⇒ OK to send.
 */
export function proposalSendBlockers(fields: ProposalFieldDef[], ctx: ProposalGateContext): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const n = proposalFieldCount(f, ctx);
    if (f.required && n === 0) {
      out.push(
        f.type === 'estimate' || f.type === 'invoice'
          ? `Add ${f.type === 'estimate' ? 'an estimate' : 'an invoice'} to the pricing (${f.label})`
          : `Fill required field: ${f.label}`,
      );
    }
    if (COUNTABLE_TYPES.includes(f.type) && f.multiple === false && n > 1) {
      const noun = f.type === 'estimate' ? 'estimate' : f.type === 'invoice' ? 'invoice' : 'file';
      out.push(`${f.label} allows only one ${noun} — you have ${n}`);
    }
  }
  return out;
}

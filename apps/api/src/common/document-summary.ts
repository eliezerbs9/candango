/**
 * Aggregate stats for a contact's estimates & invoices, shown in the QuickBooks
 * header on the People/Company "Estimates & invoices" tab. Computed from the
 * data synced into Candango (DealEstimate/DealInvoice + the deals' QBO links) —
 * NOT a live QuickBooks read. Void invoices are excluded from every invoice
 * metric (they're cancelled). Totals are in minor units (cents).
 */
export interface DocumentSummary {
  subAccounts: number; // deals linked to a QBO sub-customer (Job)
  estimates: number;
  estimatesAccepted: number;
  invoices: number;
  invoicesPaid: number;
  invoicesUnpaid: number;
  invoicesTotal: number; // sum of non-void invoice totals (minor units)
  currency: string;
}

type SummaryDoc = { kind: 'estimate' | 'invoice'; status: string; total: number; currency: string };

export function summarizeDocuments(
  documents: SummaryDoc[],
  deals: { qbSubcustomerId?: string | null }[],
): DocumentSummary {
  const estimates = documents.filter((d) => d.kind === 'estimate');
  const invoices = documents.filter((d) => d.kind === 'invoice' && d.status !== 'void');
  return {
    subAccounts: deals.filter((d) => !!d.qbSubcustomerId).length,
    estimates: estimates.length,
    estimatesAccepted: estimates.filter((d) => d.status === 'accepted').length,
    invoices: invoices.length,
    invoicesPaid: invoices.filter((d) => d.status === 'paid').length,
    invoicesUnpaid: invoices.filter((d) => d.status !== 'paid').length,
    invoicesTotal: invoices.reduce((sum, d) => sum + d.total, 0),
    currency: documents[0]?.currency ?? 'USD',
  };
}

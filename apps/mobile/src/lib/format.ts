/** Format a minor-units (cents) amount as currency, e.g. 150000 → "$1,500.00". */
export function formatMoney(valueMinor: number, currency = 'USD'): string {
  const amount = (valueMinor ?? 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Format an ISO date string as a short date, e.g. "Jul 25, 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

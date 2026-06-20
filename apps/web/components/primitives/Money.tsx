/** Formats integer minor units (cents) as a currency string. */
export function Money({ value, currency = 'USD' }: { value: number; currency?: string }) {
  return <>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100)}</>;
}

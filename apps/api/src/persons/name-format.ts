/**
 * A person's display name is derived from first/last according to the workspace's chosen format
 * (Organization.qboNameFormat: 'first_last' | 'last_first'). It's stored on Person.name so the
 * whole app — and anything that reads the name, including the QuickBooks customer — reflects the
 * choice without per-call formatting. Recomputed when a person changes or the org setting changes.
 */
export function formatPersonName(firstName: string, lastName: string, format?: string | null): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (!f) return l;
  if (!l) return f;
  return format === 'last_first' ? `${l}, ${f}` : `${f} ${l}`;
}

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { DocusealField } from './docuseal.service';

const PAGE_W = 612;
const PAGE_H = 792; // US Letter
const MARGIN = 56;

/** Footer-right zone for a page-initials field (repeated on every page). Normalized, y from top. */
export const INITIALS_ZONE = { x: 0.8, y: 0.955, w: 0.13, h: 0.028 };

export { PDFDocument };

/** A signing party that gets a signature/date/printed-name block on the appended page. */
export interface AcceptanceParty {
  label: string;
  recipient: number; // index into the submission's recipients
}

/** Field zones for one party's block, relative to the block's top (normalized y from top). */
function partyZones(top: number) {
  return {
    signature: { x: 0.091, y: top + 0.055, w: 0.42, h: 0.07 },
    date: { x: 0.58, y: top + 0.055, w: 0.33, h: 0.05 },
    name: { x: 0.091, y: top + 0.165, w: 0.42, h: 0.05 },
  };
}

/**
 * Append a clean "Acceptance & Signature" page to a loaded PDF, drawing one block per party, and
 * return the signature/date/printed-name fields (tagged with each party's recipient index). The
 * appended page is length-proof — fields always land on this known last page.
 */
export async function addAcceptancePage(doc: PDFDocument, opts: { title: string; body?: string; parties: AcceptanceParty[] }): Promise<DocusealField[]> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const signPage = doc.getPageCount(); // 1-indexed last page
  const topY = (frac: number) => PAGE_H * (1 - frac); // "from top" fraction → pdf-lib bottom-origin y

  const body = (opts.body?.trim() || `By signing below, I acknowledge and accept: ${opts.title}.`)
    // pdf-lib's WinAnsi encoding rejects characters like curly quotes / em dashes — normalize them.
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');

  page.drawText('Acceptance & Signature', { x: MARGIN, y: PAGE_H - MARGIN - 6, size: 20, font: bold, color: rgb(0.12, 0.16, 0.2) });
  page.drawText(body, { x: MARGIN, y: PAGE_H - MARGIN - 40, size: 12, font, color: rgb(0.2, 0.22, 0.25), maxWidth: PAGE_W - MARGIN * 2, lineHeight: 16 });

  const label = (text: string, z: { x: number; y: number }, bold_?: boolean) =>
    page.drawText(text, { x: PAGE_W * z.x, y: topY(z.y) + 6, size: bold_ ? 10 : 9, font: bold_ ? bold : font, color: bold_ ? rgb(0.15, 0.18, 0.22) : rgb(0.5, 0.53, 0.57) });
  const line = (z: { x: number; y: number; w: number; h: number }) => {
    const y = topY(z.y) - PAGE_H * z.h - 2;
    page.drawLine({ start: { x: PAGE_W * z.x, y }, end: { x: PAGE_W * (z.x + z.w), y }, thickness: 0.75, color: rgb(0.8, 0.82, 0.85) });
  };

  // One block per party. One party sits at ~0.50; two parties stack at ~0.46 and ~0.70.
  const tops = opts.parties.length > 1 ? [0.46, 0.7] : [0.5];
  const fields: DocusealField[] = [];
  opts.parties.forEach((party, i) => {
    const top = tops[i] ?? 0.5 + i * 0.22;
    const z = partyZones(top);
    if (opts.parties.length > 1) label(party.label, { x: 0.091, y: top - 0.005 }, true);
    label('Signature', z.signature);
    line(z.signature);
    label('Date', z.date);
    line(z.date);
    label('Printed name', z.name);
    line(z.name);
    fields.push(
      { name: `Signature ${i + 1}`, type: 'signature', role: 'Client', recipient: party.recipient, areas: [{ page: signPage, ...z.signature }] },
      { name: `Date ${i + 1}`, type: 'date', role: 'Client', recipient: party.recipient, areas: [{ page: signPage, ...z.date }] },
      // NAME auto-fills the signer's name (no typing needed).
      { name: `Printed name ${i + 1}`, type: 'name', role: 'Client', recipient: party.recipient, areas: [{ page: signPage, ...z.name }] },
    );
  });

  return fields;
}

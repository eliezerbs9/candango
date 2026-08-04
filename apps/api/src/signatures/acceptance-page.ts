import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792; // US Letter
const MARGIN = 56;

/** Field zones on the appended acceptance page — DocuSeal normalized coords (y measured from the top). */
export const ACCEPTANCE_FIELDS = {
  signature: { x: 0.091, y: 0.55, w: 0.42, h: 0.07 },
  date: { x: 0.58, y: 0.55, w: 0.33, h: 0.05 },
  name: { x: 0.091, y: 0.68, w: 0.42, h: 0.05 },
};

/** Footer-right zone for a page-initials field (repeated on every page). Normalized, y from top. */
export const INITIALS_ZONE = { x: 0.8, y: 0.955, w: 0.13, h: 0.028 };

export { PDFDocument };

/**
 * Append a clean "Acceptance & Signature" page to a loaded PDF and return the 1-indexed page number
 * of the appended page. Length-proof: the signature fields always land on this known page.
 */
export async function addAcceptancePage(doc: PDFDocument, opts: { title: string; body?: string }): Promise<number> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const topY = (frac: number) => PAGE_H * (1 - frac); // "from top" fraction → pdf-lib bottom-origin y

  const body = (opts.body?.trim() || `By signing below, I acknowledge and accept: ${opts.title}.`)
    // pdf-lib's WinAnsi encoding rejects characters like curly quotes / em dashes — normalize them.
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');

  page.drawText('Acceptance & Signature', { x: MARGIN, y: PAGE_H - MARGIN - 6, size: 20, font: bold, color: rgb(0.12, 0.16, 0.2) });
  page.drawText(body, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 40,
    size: 12,
    font,
    color: rgb(0.2, 0.22, 0.25),
    maxWidth: PAGE_W - MARGIN * 2,
    lineHeight: 16,
  });

  const label = (text: string, z: { x: number; y: number }) => page.drawText(text, { x: PAGE_W * z.x, y: topY(z.y) + 6, size: 9, font, color: rgb(0.5, 0.53, 0.57) });
  const line = (z: { x: number; y: number; w: number; h: number }) => {
    const y = topY(z.y) - PAGE_H * z.h - 2;
    page.drawLine({ start: { x: PAGE_W * z.x, y }, end: { x: PAGE_W * (z.x + z.w), y }, thickness: 0.75, color: rgb(0.8, 0.82, 0.85) });
  };
  label('Signature', ACCEPTANCE_FIELDS.signature);
  line(ACCEPTANCE_FIELDS.signature);
  label('Date', ACCEPTANCE_FIELDS.date);
  line(ACCEPTANCE_FIELDS.date);
  label('Printed name', ACCEPTANCE_FIELDS.name);
  line(ACCEPTANCE_FIELDS.name);

  return doc.getPageCount(); // 1-indexed last page
}

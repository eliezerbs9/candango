import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792; // US Letter
const MARGIN = 56;

/** Field zones on the appended page — DocuSeal normalized coords (y measured from the top). */
export const ACCEPTANCE_FIELDS = {
  signature: { x: 0.091, y: 0.55, w: 0.42, h: 0.07 },
  date: { x: 0.58, y: 0.55, w: 0.33, h: 0.05 },
  name: { x: 0.091, y: 0.68, w: 0.42, h: 0.05 },
};

/**
 * Append a clean "Acceptance & Signature" page to any PDF and return the merged bytes + the 1-indexed
 * page number of the appended page. Length-proof: signature fields always land on this known page,
 * whatever the source document's length/content.
 */
export async function appendAcceptancePage(src: Buffer, opts: { title: string }): Promise<{ pdf: Buffer; signPage: number }> {
  const doc = await PDFDocument.load(src);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const topY = (frac: number) => PAGE_H * (1 - frac); // "from top" fraction → pdf-lib bottom-origin y

  page.drawText('Acceptance & Signature', { x: MARGIN, y: PAGE_H - MARGIN - 6, size: 20, font: bold, color: rgb(0.12, 0.16, 0.2) });
  page.drawText(`By signing below, I acknowledge and accept: ${opts.title}.`, {
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

  const bytes = await doc.save();
  return { pdf: Buffer.from(bytes), signPage: doc.getPageCount() };
}

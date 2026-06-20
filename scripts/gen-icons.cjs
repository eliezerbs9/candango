// Generates favicon.ico + apple-icon.png from a font-independent vector "C" mark.
// Run: node scripts/gen-icons.cjs   (from repo root; uses hoisted `sharp`)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'apps', 'web');
const APP = path.join(WEB, 'app');
const BRAND = path.join(WEB, 'public', 'brand');

// Rounded square in brand terracotta + a white "C" drawn as a stroked arc (no fonts).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#d9552c"/>
  <path d="M41 23 A13 13 0 1 0 41 41" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
</svg>
`;

function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const datas = [];
  images.forEach((img, i) => {
    const e = entries.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.buffer.length;
    datas.push(img.buffer);
  });
  return Buffer.concat([header, entries, ...datas]);
}

(async () => {
  // 1) write the vector SVG (used as /icon.svg link + brand asset)
  fs.writeFileSync(path.join(APP, 'icon.svg'), SVG);
  fs.mkdirSync(BRAND, { recursive: true });
  fs.writeFileSync(path.join(BRAND, 'icon.svg'), SVG);

  // 2) favicon.ico (multi-size PNG-in-ICO)
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const buffer = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
    images.push({ size, buffer });
  }
  fs.writeFileSync(path.join(APP, 'favicon.ico'), buildIco(images));

  // 3) apple-icon.png (180x180)
  const apple = await sharp(Buffer.from(SVG)).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(APP, 'apple-icon.png'), apple);

  console.log('Generated: app/icon.svg, app/favicon.ico, app/apple-icon.png, public/brand/icon.svg');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

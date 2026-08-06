// Copy the pdf.js worker into public/ so the app serves it same-origin (no cross-origin CDN worker,
// which is unreliable). Runs on predev/prebuild so the copy always matches the installed pdfjs-dist.
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('pdfjs-dist/package.json'));
const src = join(pkgDir, 'build', 'pdf.worker.min.mjs');
const dest = join(process.cwd(), 'public', 'pdf.worker.min.mjs');
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);

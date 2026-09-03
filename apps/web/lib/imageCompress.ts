/**
 * Client-side image compression before upload — shrinks phone photos (often 5–10 MB) to a few
 * hundred KB with no visible loss, cutting object-storage cost. Downscales to a max long-edge and
 * re-encodes as JPEG. Leaves non-raster/animated formats (GIF, SVG) and already-small images
 * untouched, and never grows a file.
 *
 * Called from `uploadFile()` (lib/api/uploads.ts), which every upload goes through — so this runs
 * for every file in the app and no call site has to remember it.
 */
const MAX_DIM = 2000; // px, long edge
const QUALITY = 0.8;
const SKIP_UNDER = 600 * 1024; // don't bother re-encoding images already under ~600 KB

/** Formats a canvas can't meaningfully re-encode: animation and vectors are passed through. */
const PASSTHROUGH = new Set(['image/gif', 'image/svg+xml']);

/**
 * Files this module has already handled. `uploadFile()` compresses everything, and some call sites
 * compress first so they can validate the *stored* size against their cap — this makes the second
 * call a no-op instead of a second lossy JPEG pass over the same pixels.
 */
const handled = new WeakSet<File>();

/**
 * Decode to a bitmap. `createImageBitmap` decodes off the main thread (no jank on a 10 MB photo);
 * the `<img>` path is the fallback for browsers without it.
 *
 * HEIC/HEIF note: Chrome and Firefox cannot decode it, so `decode` throws and the caller uploads
 * the original untouched — deliberate, not a silent bug. iOS converts HEIC to JPEG when a photo is
 * picked, so phones (the main source of big photos) are already covered.
 */
async function decode(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { bitmap: img, width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draw to a canvas (offscreen when supported) and encode as JPEG. */
async function encodeJpeg(
  source: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
}

/** Remember a file as already processed, then return it. */
function keep(file: File): File {
  handled.add(file);
  return file;
}

/**
 * Compress an image File. Returns the original untouched when it isn't a raster image, is already
 * small enough, can't be decoded, or when compressing would make it bigger — so a caller can always
 * upload the result without checking anything.
 */
export async function compressImage(file: File): Promise<File> {
  if (handled.has(file)) return file;
  if (!file.type.startsWith('image/') || PASSTHROUGH.has(file.type)) return keep(file);

  let source: ImageBitmap | HTMLImageElement | undefined;
  try {
    const { bitmap, width, height } = await decode(file);
    source = bitmap;
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));

    // Small AND within bounds: re-encoding would only lose quality. PNGs are still re-encoded when
    // oversized — that's what shrinks the full-page PNGs the PDF importer rasterizes.
    if (scale === 1 && file.size < SKIP_UNDER) return keep(file);

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const blob = await encodeJpeg(source, w, h);
    if (!blob || blob.size >= file.size) return keep(file); // never grow the file

    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return keep(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
  } catch {
    return keep(file); // undecodable (HEIC on desktop, corrupt file, …) → upload the original
  } finally {
    if (source && 'close' in source) source.close();
  }
}

/**
 * Client-side image compression before upload — shrinks phone photos (often 5–10 MB) to a few
 * hundred KB with no visible loss, cutting object-storage cost. Downscales to a max long-edge and
 * re-encodes as JPEG via a canvas. Leaves non-raster/animated formats (GIF, SVG) and already-small
 * images untouched, and never grows a file.
 */
const MAX_DIM = 2000; // px, long edge
const QUALITY = 0.8;
const SKIP_UNDER = 600 * 1024; // don't bother re-encoding images already under ~600 KB

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const longEdge = Math.max(img.width, img.height);
    const scale = Math.min(1, MAX_DIM / longEdge);
    // Nothing to gain: already small and not oversized.
    if (scale === 1 && file.size < SKIP_UNDER) return file;

    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file; // never grow the file

    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // any failure → upload the original untouched
  } finally {
    URL.revokeObjectURL(url);
  }
}

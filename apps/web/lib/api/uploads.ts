import { apiFetch } from './client';
import { compressImage } from '../imageCompress';

export function getUploadStatus(token: string) {
  return apiFetch<{ configured: boolean }>('/uploads/status', { token });
}

export function presignUpload(token: string, body: { entity: string; filename: string; contentType: string }) {
  return apiFetch<{ key: string; uploadUrl: string }>('/uploads/presign', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

/** PUT the file straight to Spaces using the presigned URL (must echo the content type). */
export async function putToSpaces(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error('Upload failed');
}

export function getFileUrl(token: string, key: string) {
  return apiFetch<{ url: string }>(`/uploads/url?key=${encodeURIComponent(key)}`, { token });
}

export function deleteUpload(token: string, key: string) {
  return apiFetch<{ ok: boolean }>(`/uploads?key=${encodeURIComponent(key)}`, { method: 'DELETE', token });
}

/**
 * Presign + upload a file to Spaces; resolves to the stored object key.
 *
 * Images are compressed FIRST, so the presigned key, filename and content type describe what is
 * actually stored. Every upload in the app goes through here, which is why compression lives at
 * this choke point instead of at each call site (it used to be wired into only 3 of 8).
 */
export async function uploadFile(token: string, entity: string, file: File): Promise<string> {
  const toUpload = await compressImage(file);
  const { key, uploadUrl } = await presignUpload(token, {
    entity,
    filename: toUpload.name,
    contentType: toUpload.type || 'application/octet-stream',
  });
  await putToSpaces(uploadUrl, toUpload);
  return key;
}

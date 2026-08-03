import { apiFetch } from './client';

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

/** Presign + upload a file to Spaces; resolves to the stored object key. */
export async function uploadFile(token: string, entity: string, file: File): Promise<string> {
  const { key, uploadUrl } = await presignUpload(token, {
    entity,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
  });
  await putToSpaces(uploadUrl, file);
  return key;
}

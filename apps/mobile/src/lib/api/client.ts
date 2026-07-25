/**
 * Typed fetch wrapper over the Candango REST API.
 * Mirrors apps/web/lib/api/client.ts (same error envelope + Bearer auth),
 * adapted for React Native: the base URL comes from src/config.ts.
 */
import { API_URL } from '@/config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiOptions = RequestInit & { token?: string };

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    // Supports both our envelope ({ error: { code, message } }) and Nest's
    // default ({ message, error, statusCode }, where message may be an array).
    const envelope = (body as { error?: { code?: string; message?: string } }).error;
    const nestMessage = (body as { message?: string | string[] }).message;
    const message =
      (Array.isArray(nestMessage) ? nestMessage.join(', ') : nestMessage) ||
      envelope?.message ||
      res.statusText;
    const code = envelope?.code ?? 'error';
    throw new ApiError(res.status, code, message);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * Typed fetch wrapper over the Candango REST API (see openapi spec).
 * Injects the Bearer token and parses the standard error envelope.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/v1';

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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const err = (body as { error?: { code?: string; message?: string } }).error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? res.statusText);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

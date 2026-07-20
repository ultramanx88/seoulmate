const apiBaseUrl = ((import.meta as any).env?.VITE_API_URL ?? '').replace(/\/$/, '');

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null): void {
  authTokenGetter = getter;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await authTokenGetter?.();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

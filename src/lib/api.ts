export type AuthProvider = 'google' | 'line' | 'kakao' | 'naver';

const apiBaseUrl = ((import.meta as any).env?.VITE_API_URL ?? '').replace(/\/$/, '');

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function startOAuth(provider: AuthProvider): void {
  window.location.href = `${apiBaseUrl}/v1/auth/${provider}/start`;
}

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

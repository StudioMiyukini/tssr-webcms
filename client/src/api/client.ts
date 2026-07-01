export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(path, { credentials: 'include', ...options, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('cms:unauthorized'));
    }
    const message = (body && typeof body === 'object' && body.error) ? String(body.error) : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, data?: unknown) => api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
export const apiPut = <T>(path: string, data?: unknown) => api<T>(path, { method: 'PUT', body: data === undefined ? undefined : JSON.stringify(data) });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });

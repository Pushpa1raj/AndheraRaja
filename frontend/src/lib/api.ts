import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? (data as { detail: unknown }).detail
        : null
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg || '').join(', ')
      : `API Error: ${status} ${statusText}`
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options
  const supabase = createClient()

  let token: string | undefined
  let userId = 'anon'
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    token = session?.access_token
    userId = session?.user?.id || 'anon'
  } catch {
    // Client auth session fetch fallback
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }

  // Authoritative endpoints require an Idempotency-Key between 16 and 255 chars
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    if (!reqHeaders['Idempotency-Key'] && !reqHeaders['idempotency-key']) {
      reqHeaders['Idempotency-Key'] = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`
    }
  }

  const config: RequestInit = {
    method,
    headers: reqHeaders,
  }

  if (body !== undefined) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_URL}${endpoint}`, config)

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, response.statusText, data)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    api<T>(endpoint, { method: 'GET', ...options }),
  post: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    api<T>(endpoint, { method: 'POST', body, ...options }),
  put: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    api<T>(endpoint, { method: 'PUT', body, ...options }),
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    api<T>(endpoint, { method: 'PATCH', body, ...options }),
  delete: <T = unknown>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    api<T>(endpoint, { method: 'DELETE', ...options }),
}

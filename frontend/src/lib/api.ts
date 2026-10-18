import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ApiOptions {
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
    super(`API Error: ${status} ${statusText}`)
    this.name = 'ApiError'
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...headers,
    },
  }

  if (body) {
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
  get: <T = unknown>(endpoint: string) => api<T>(endpoint),
  post: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'POST', body }),
  put: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'PUT', body }),
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'PATCH', body }),
  delete: <T = unknown>(endpoint: string) =>
    api<T>(endpoint, { method: 'DELETE' }),
}

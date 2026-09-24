import { API_URL, ORG_TOKEN } from './constants'

export type ApiInit = { method?: string; token?: string; body?: unknown }

export const api = async <T>(path: string, init: ApiInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`,
    )
  }
  return (await response.json()) as T
}

export const orgApi = <T>(path: string, init: ApiInit = {}): Promise<T> => {
  if (!ORG_TOKEN) {
    throw new Error('E2E_ORG_TOKEN is not set: run `dev e2e setup`')
  }
  return api<T>(path, { ...init, token: ORG_TOKEN })
}

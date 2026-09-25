import { API_URL, ORG_TOKEN } from './constants'

export type ApiInit = { method?: string; token?: string; body?: unknown }

const RATE_LIMIT_RETRIES = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const request = (path: string, init: ApiInit) =>
  fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

export const api = async <T>(path: string, init: ApiInit = {}): Promise<T> => {
  let response = await request(path, init)
  for (
    let retry = 0;
    response.status === 429 && retry < RATE_LIMIT_RETRIES;
    retry++
  ) {
    await sleep(
      Math.min(Number(response.headers.get('retry-after') ?? 5), 10) * 1000,
    )
    response = await request(path, init)
  }
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const orgApi = <T>(path: string, init: ApiInit = {}): Promise<T> => {
  if (!ORG_TOKEN) {
    throw new Error('E2E_ORG_TOKEN is not set: run `dev e2e setup`')
  }
  return api<T>(path, { ...init, token: ORG_TOKEN })
}

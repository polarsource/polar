/**
 * A structural fake of `@polar-sh/client` for tests — routes calls by
 * (method, path) and returns openapi-fetch-shaped `{ data, error, response }`.
 * No network. A route may throw to simulate a transport failure.
 */
import type { PolarClient } from '../src/polar-client'

export interface FakeReply {
  data?: unknown
  error?: unknown
  status?: number
  headers?: Record<string, string>
}

export type FakeRoute = (
  method: string,
  path: string,
  opts: { body?: any; params?: any },
) => FakeReply

export interface FakeCall {
  method: string
  path: string
  opts: { body?: any; params?: any }
}

export const fakePolarClient = (
  route: FakeRoute,
): { client: PolarClient; calls: FakeCall[] } => {
  const calls: FakeCall[] = []
  const make =
    (method: string) =>
    (path: string, opts: { body?: any; params?: any } = {}) => {
      calls.push({ method, path, opts })
      const r = route(method, path, opts) // may throw → simulates a network failure
      const response = new Response(null, {
        status: r.status ?? 200,
        ...(r.headers ? { headers: r.headers } : {}),
      })
      return Promise.resolve({ data: r.data, error: r.error, response })
    }
  const client = {
    GET: make('GET'),
    POST: make('POST'),
    PATCH: make('PATCH'),
    PUT: make('PUT'),
    DELETE: make('DELETE'),
  } as unknown as PolarClient
  return { client, calls }
}

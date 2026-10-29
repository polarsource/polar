import { expect } from 'vitest'
import worker from '../src/index'
import { env } from './workers'

const context = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext

export const request = (path: string, init?: RequestInit) =>
  (worker as ExportedHandler<Env>).fetch!(
    new Request(`https://mcp.polar.test${path}`, init) as unknown as Request<
      unknown,
      IncomingRequestCfProperties
    >,
    env as unknown as Env,
    context,
  )

export const rpc = async (
  method: string,
  params: Record<string, unknown> = {},
  query = '',
  headers: Record<string, string> = {},
) => {
  const response = await request(`/mcp/polar-mcp${query}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer polar_oat_test',
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Protocol-Version': '2025-11-25',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  const text = await response.text()
  const data = text.startsWith('event:')
    ? text
        .split('\n')
        .find((line) => line.startsWith('data:'))!
        .slice(5)
    : text
  return JSON.parse(data)
}

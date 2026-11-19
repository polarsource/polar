import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { spec } from '../src/spec'
import { rpc } from './client'

const fetchMock = vi.fn<typeof fetch>()

const EVENTS_URL = 'https://api.polar.test/v1/mcp/events/'

const urlOf = (input: Parameters<typeof fetch>[0]) =>
  new URL(input instanceof Request ? input.url : input).href

const apiResponse = (response: Response) =>
  fetchMock.mockImplementation(async (input) =>
    urlOf(input).startsWith(EVENTS_URL)
      ? response
      : Response.json({ items: [] }),
  )

const eventsCalls = () =>
  fetchMock.mock.calls.flatMap(([input, init]) =>
    urlOf(input).startsWith(EVENTS_URL) ? [{ url: urlOf(input), init }] : [],
  )

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  apiResponse(Response.json({ items: [] }))
})
afterEach(() => vi.unstubAllGlobals())

const SUBSCRIBE_PARAMS = {
  name: 'order.paid',
  arguments: { product_id: 'prod_1' },
  delivery: {
    mode: 'webhook',
    url: 'https://receiver.test/callback',
    secret: 'whsec_test',
  },
  cursor: null,
  ttlMs: 86_400_000,
}

test('initialize and server/discover advertise events, except on read-only connections', async () => {
  const initialize = (query: string) =>
    rpc(
      'initialize',
      {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
      query,
    )
  expect((await initialize('')).result.capabilities.events).toEqual({})
  expect(
    (await initialize('?readonly=true')).result.capabilities,
  ).not.toHaveProperty('events')
  const discover = await rpc(
    'server/discover',
    {
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
    '',
    { 'Mcp-Protocol-Version': '2026-07-28', 'Mcp-Method': 'server/discover' },
  )
  expect(discover.result.capabilities.events).toEqual({})
  expect((await rpc('events/list', {}, '?readonly=true')).error.code).toBe(
    -32601,
  )
})

test('events/list returns the backend catalog as webhook events', async () => {
  const inputSchema = { type: 'object', properties: {} }
  const payloadSchema = { type: 'object', properties: { id: {} } }
  apiResponse(
    Response.json({
      items: [
        {
          name: 'order.paid',
          description: 'An order was paid.',
          input_schema: inputSchema,
          payload_schema: payloadSchema,
        },
      ],
    }),
  )
  expect((await rpc('events/list', {})).result).toEqual({
    events: [
      {
        name: 'order.paid',
        description: 'An order was paid.',
        delivery: ['webhook'],
        inputSchema,
        payloadSchema,
      },
    ],
  })
  const [{ url, init }] = eventsCalls()
  expect(url).toBe(EVENTS_URL)
  const headers = new Headers(init?.headers)
  expect(headers.get('Authorization')).toBe('Bearer polar_oat_test')
  expect(headers.get('User-Agent')).toBe('polar-mcp')
  expect(headers.get('Polar-Version')).toBe(spec.apiVersion)
})

test('events/subscribe creates the subscription and returns when to refresh it', async () => {
  apiResponse(
    Response.json({ id: 'sub_1', expires_at: '2026-11-04T12:00:00Z' }),
  )
  expect((await rpc('events/subscribe', SUBSCRIBE_PARAMS)).result).toEqual({
    id: 'sub_1',
    refreshBefore: '2026-11-04T12:00:00Z',
    cursor: null,
    truncated: false,
  })
  const [{ url, init }] = eventsCalls()
  expect(url).toBe(`${EVENTS_URL}subscribe`)
  expect(init?.method).toBe('POST')
  expect(JSON.parse(init!.body as string)).toEqual({
    name: 'order.paid',
    arguments: { product_id: 'prod_1' },
    url: 'https://receiver.test/callback',
    secret: 'whsec_test',
    ttl_ms: 86_400_000,
  })
})

test('events/unsubscribe removes the subscription', async () => {
  apiResponse(new Response(null, { status: 204 }))
  expect(
    (
      await rpc('events/unsubscribe', {
        name: 'order.paid',
        delivery: { mode: 'webhook', url: 'https://receiver.test/callback' },
      })
    ).result,
  ).toEqual({})
  const [{ url, init }] = eventsCalls()
  expect(url).toBe(`${EVENTS_URL}unsubscribe`)
  expect(JSON.parse(init!.body as string)).toEqual({
    name: 'order.paid',
    arguments: {},
    url: 'https://receiver.test/callback',
  })
})

test.each([
  {
    status: 422,
    error: 'RequestValidationError',
    detail: [],
    code: -32602,
    data: undefined,
  },
  {
    status: 404,
    error: 'ResourceNotFound',
    detail: 'Not found',
    code: -32023,
    data: { kind: 'event' },
  },
  {
    status: 403,
    error: 'NotPermitted',
    detail: 'Forbidden',
    code: -32024,
    data: undefined,
  },
  {
    status: 400,
    error: 'CallbackEndpointError',
    detail: 'challenge_failed',
    code: -32015,
    data: { reason: 'challenge_failed' },
  },
  {
    status: 500,
    error: 'InternalServerError',
    detail: 'Boom',
    code: -32603,
    data: undefined,
  },
])(
  'a $status $error from the backend becomes JSON-RPC error $code',
  async ({ status, error, detail, code, data }) => {
    apiResponse(Response.json({ error, detail }, { status }))
    const response = await rpc('events/subscribe', SUBSCRIBE_PARAMS)
    expect(response.error.code).toBe(code)
    expect(response.error.data).toEqual(data)
  },
)

test('events/subscribe rejects delivery modes other than webhook without calling the backend', async () => {
  const { error } = await rpc('events/subscribe', {
    ...SUBSCRIBE_PARAMS,
    delivery: { mode: 'stream' },
  })
  expect(error.code).toBe(-32026)
  expect(eventsCalls()).toHaveLength(0)
})

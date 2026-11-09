import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { Docs } from '../src/docs'
import { RequestLog, type RequestLogEntry } from '../src/log'
import { PolarApiOutbound, type PolarApiOutboundProps } from '../src/outbound'
import { makeToolRunner } from '../src/results'
import { isAllowedOperation, redactPath, spec } from '../src/spec'
import { request, rpc } from './client'
import { evaluate, exports, get } from './workers'

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

test('outbound rejects other origins, writes in read-only mode, and unexposed operations', async () => {
  const props = {
    apiUrl: 'https://api.polar.test',
    token: 'secret',
    readOnly: true,
  }
  const outbound = new PolarApiOutbound(
    { props } as ExecutionContext<PolarApiOutboundProps>,
    {} as Env,
  )
  for (const [url, method, status, error, detail] of [
    [
      'https://attacker.test/v1/products/',
      'GET',
      403,
      'Forbidden',
      'Requests to https://attacker.test are not allowed',
    ],
    [
      'https://api.polar.test/v1/products/',
      'POST',
      403,
      'Forbidden',
      'This connection is read-only: only GET is allowed',
    ],
    [
      'https://api.polar.test/v1/oauth2/userinfo',
      'GET',
      404,
      'NotFound',
      'GET /v1/oauth2/userinfo is not an operation exposed by this server. Use the search tool to find it.',
    ],
  ] as const) {
    const response = await outbound.fetch(new Request(url, { method }))
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error, detail })
  }
  expect(fetchMock).not.toHaveBeenCalled()
  props.readOnly = false
  fetchMock.mockResolvedValueOnce(new Response('stream', { status: 201 }))
  const response = await outbound.fetch(
    new Request('https://api.polar.test/v1/products/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer attacker',
        'User-Agent': 'attacker',
        'Polar-Version': '1999-01',
        'Content-Type': 'application/json',
      },
      body: '{"name":"Product"}',
    }),
  )
  expect(response.status).toBe(201)
  expect(await response.text()).toBe('stream')
  const forwarded = fetchMock.mock.calls[0][0] as Request
  expect(forwarded.headers.get('Authorization')).toBe('Bearer secret')
  expect(forwarded.headers.get('User-Agent')).toBe('polar-mcp')
  expect(forwarded.headers.get('Polar-Version')).toBe(spec.apiVersion)
  expect(await forwarded.text()).toBe('{"name":"Product"}')
})

test('only methods and paths of exposed operations are allowed', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  expect(isAllowedOperation('GET', `/v1/orders/${id}`)).toBe(true)
  expect(isAllowedOperation('PATCH', `/v1/orders/${id}`)).toBe(true)
  expect(isAllowedOperation('GET', '/v1/oauth2/userinfo')).toBe(false)
  expect(isAllowedOperation('DELETE', `/v1/orders/${id}`)).toBe(false)
})

test('unexposed paths keep only the words an API path has at the same position', () => {
  expect(redactPath('/v1/customers/external/customers/unknown')).toBe(
    '/v1/customers/external/{}/{}',
  )
  expect(redactPath('/v1/customers/jane@example.com/bogus')).toBe(
    '/v1/customers/{}/{}',
  )
  expect(redactPath('/v1/products/')).toBe('/v1/products/')
  expect(
    redactPath(
      '/v1/customer-portal/benefit-grants/11111111-1111-4111-8111-111111111111',
    ),
  ).toBe('/v1/customer-portal/benefit-grants/{}')
})

test('operation writes preserve path parameters and JSON body, and read-only tools reject writes', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ items: [] }))
    .mockResolvedValueOnce(Response.json({ name: 'Updated' }))
  const id = '11111111-1111-4111-8111-111111111111'
  const params = {
    name: 'products_update',
    arguments: { id, body: { name: 'Updated' } },
  }
  const result = await rpc('tools/call', params, '?codemode=false')
  expect(result.result.content[0].text).toBe('{"name":"Updated"}')
  const [input, init] = fetchMock.mock.calls[1]
  expect(new URL(input instanceof Request ? input.url : input).href).toBe(
    `https://api.polar.test/v1/products/${id}`,
  )
  expect(init?.method).toBe('PATCH')
  expect(new Headers(init?.headers).get('Content-Type')).toBe(
    'application/json',
  )
  const body = init?.body
  expect(
    body instanceof Uint8Array ? new TextDecoder().decode(body) : body,
  ).toBe('{"name":"Updated"}')
  const rejected = await rpc(
    'tools/call',
    params,
    '?codemode=false&readonly=true',
  )
  expect(rejected.result?.isError ?? !!rejected.error).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('upstream failures remain tool errors and OAuth network failures return 503', async () => {
  fetchMock.mockRejectedValue(new Error('network failed'))
  expect(
    (
      await rpc(
        'tools/call',
        { name: 'products_list', arguments: {} },
        '?codemode=false',
      )
    ).result,
  ).toEqual({
    isError: true,
    content: [{ type: 'text', text: 'Error: network failed' }],
  })
  expect(
    (
      await request('/mcp/polar-mcp', {
        headers: { Authorization: 'Bearer polar_at_network_failure' },
      })
    ).status,
  ).toBe(503)
  fetchMock.mockResolvedValueOnce(new Response('not json'))
  expect(
    (
      await rpc(
        'tools/call',
        { name: 'products_list', arguments: {} },
        '?codemode=false',
      )
    ).result.isError,
  ).toBe(true)
})

test('sandbox evaluation and binding errors preserve their original messages', async () => {
  evaluate.mockResolvedValueOnce({ error: 'code failed' })
  const params = { name: 'search', arguments: { code: 'async () => 1' } }
  expect((await rpc('tools/call', params)).result).toEqual({
    isError: true,
    content: [{ type: 'text', text: 'Error: code failed' }],
  })
  get.mockImplementationOnce(() => {
    throw new Error('loader failed')
  })
  expect((await rpc('tools/call', params)).result.content[0].text).toBe(
    'Error: loader failed',
  )
  exports.PolarApiOutbound.mockImplementationOnce(() => {
    throw new Error('binding failed')
  })
  expect(
    (await rpc('tools/call', { ...params, name: 'execute' })).result.content[0]
      .text,
  ).toBe('Error: binding failed')
})

test('cancelling an MCP tool interrupts its effect and runs finalizers, and cancellations and crashes are logged apart', async () => {
  const controller = new AbortController()
  let finalized = false
  const effect = Effect.acquireUseRelease(
    Effect.void,
    () => Effect.never,
    () =>
      Effect.sync(() => {
        finalized = true
      }),
  )
  const log: RequestLogEntry = {
    event: 'mcp.request',
    server: 'polar-mcp',
    mode: 'codemode',
    readOnly: false,
    telemetry: true,
    userAgent: null,
  }
  const runTool = await Effect.runPromise(
    makeToolRunner.pipe(Effect.provideService(RequestLog, log)),
  )
  const pending = runTool(effect, controller.signal)
  controller.abort()
  await expect(pending).rejects.toThrow()
  expect(finalized).toBe(true)
  expect(log).toMatchObject({ isError: true, errorKind: 'cancelled' })

  await expect(
    runTool(Effect.die(new Error('boom')), new AbortController().signal),
  ).rejects.toThrow('boom')
  expect(log).toMatchObject({ isError: true, errorKind: 'internal' })
})

test('docs search fails with a configuration error without a search key', async () => {
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      const docs = yield* Docs
      return yield* docs.search('checkout')
    }).pipe(
      Effect.flip,
      Effect.provide(Docs.layer(undefined)),
      Effect.provide(FetchHttpClient.layer),
    ),
  )
  expect(error.message).toBe(
    'Docs search is not configured: set the MINTLIFY_SEARCH_KEY secret',
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

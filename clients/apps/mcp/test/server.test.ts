import { createHmac } from 'node:crypto'
import { runInThisContext } from 'node:vm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { request, rpc } from './client'
import scopes from '../src/generated/scopes.json'
import { toolNames } from '../src/analytics'
import tools from '../src/generated/tools.json'
import { spec } from '../src/spec'
import { env, evaluate, exports, get, waitUntil } from './workers'

const DOCS_TOOLS = ['search_docs', 'read_docs_page']

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue(Response.json({ items: [] }))
  evaluate.mockReset().mockResolvedValue({ result: 'sandbox result' })
  get.mockClear()
  exports.PolarApiOutbound.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

const RESOURCE_METADATA_URL =
  'https://mcp.polar.test/.well-known/oauth-protected-resource/mcp/polar-mcp'
const ALL_SCOPES = [...scopes.read, ...scopes.write]

test('CORS, metadata, unknown routes and bearer challenges remain unchanged', async () => {
  const preflight = await request('/anything', { method: 'OPTIONS' })
  expect(preflight.status).toBe(204)
  expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe(
    'GET, POST, OPTIONS',
  )
  const metadata = await request(
    '/.well-known/oauth-protected-resource/mcp/polar-mcp',
  )
  expect(await metadata.json()).toEqual({
    resource: 'https://mcp.polar.test/mcp/polar-mcp',
    authorization_servers: ['https://api.polar.test'],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Polar',
  })
  const challenge = await request('/.well-known/openai-apps-challenge')
  expect(challenge.headers.get('Content-Type')).toBe('text/plain')
  expect(await challenge.text()).toBe(
    'ZjVpZNBFeHL9gB3r9BKCLpb68RF88tIzveJIntQm90E',
  )
  for (const path of [
    '/mcp/unknown',
    '/mcp/polar-mcp/',
    '/.well-known/oauth-protected-resource/mcp/unknown',
  ]) {
    expect((await request(path)).status).toBe(404)
  }
  for (const authorization of ['', 'Basic secret', 'Bearer']) {
    const response = await request('/mcp/polar-mcp', {
      headers: { Authorization: authorization },
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
    expect(response.headers.get('WWW-Authenticate')).toBe(
      `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="${ALL_SCOPES.join(' ')}"`,
    )
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test('scopes are the least-privileged scopes of the exposed operations, and read-only connections challenge for read scopes only', async () => {
  expect(scopes.read).toContain('products:read')
  expect(scopes.read).not.toContain('products:write')
  expect(scopes.write).toContain('products:write')
  expect(scopes.read.every((scope) => !scope.endsWith(':write'))).toBe(true)
  expect(scopes.write.every((scope) => !scopes.read.includes(scope))).toBe(true)

  const missing = await request('/mcp/polar-mcp?readonly=true')
  expect(missing.headers.get('WWW-Authenticate')).toBe(
    `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="${scopes.read.join(' ')}"`,
  )
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
  const invalid = await request('/mcp/polar-mcp?readonly=true', {
    headers: { Authorization: 'Bearer polar_at_revoked' },
  })
  expect(invalid.headers.get('WWW-Authenticate')).toBe(
    `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="${scopes.read.join(' ')}", error="invalid_token"`,
  )
})

test('OAuth validates per environment, caches for 60 seconds, and rejects 401s and upstream failures without caching them', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const headers = { Authorization: 'Bearer polar_at_cache_test' }
  await request('/mcp/polar-mcp', { headers })
  await request('/mcp/polar-mcp', { headers })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await request('/mcp/polar-sandbox', { headers })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  now += 60_000
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
  for (let i = 0; i < 2; i++) {
    const response = await request('/mcp/polar-mcp', { headers })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid_token' })
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'error="invalid_token"',
    )
  }
  expect(fetchMock).toHaveBeenCalledTimes(4)
  for (const status of [404, 500, 503]) {
    fetchMock.mockResolvedValue(new Response(null, { status }))
    const response = await request('/mcp/polar-mcp', { headers })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'temporarily_unavailable' })
  }
  expect(fetchMock).toHaveBeenCalledTimes(7)
})

test('organization access tokens validate against an endpoint that accepts them, and a 403 means the token is valid', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
  const valid = { Authorization: 'Bearer polar_oat_without_scope' }
  expect((await request('/mcp/polar-mcp', { headers: valid })).status).not.toBe(
    401,
  )
  const [input, init] = fetchMock.mock.calls[0]
  expect(new URL(input instanceof Request ? input.url : input).href).toBe(
    'https://api.polar.test/v1/organizations/?limit=1',
  )
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer polar_oat_without_scope',
  )
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
  const response = await request('/mcp/polar-mcp', {
    headers: { Authorization: 'Bearer polar_oat_revoked' },
  })
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'invalid_token' })
})

test('tokens that are neither OAuth nor organization access tokens are rejected without calling the API', async () => {
  for (const token of ['garbage', 'polar_pat_test', 'polar_cst_test']) {
    const response = await request('/mcp/polar-mcp', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid_token' })
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test('code mode is the default for every client; ?codemode=false selects operation mode', async () => {
  const defaultTools = (await rpc('tools/list')).result.tools
  expect(defaultTools.map((tool: { name: string }) => tool.name)).toEqual([
    'search',
    'execute',
    ...DOCS_TOOLS,
  ])
  expect(defaultTools[0].inputSchema.properties.code.type).toBe('string')
  expect(defaultTools[0].inputSchema.required).toEqual(['code'])
  expect(
    (await rpc('tools/list', {}, '?codemode=true')).result.tools,
  ).toHaveLength(4)
  const operations = (await rpc('tools/list', {}, '?codemode=false')).result
    .tools
  expect(operations.map((tool: { name: string }) => tool.name)).toEqual([
    ...tools.map((tool) => tool.name),
    ...DOCS_TOOLS,
  ])
  const readOnly = (
    await rpc('tools/list', {}, '?codemode=false&readonly=true')
  ).result.tools
  expect(readOnly.map((tool: { name: string }) => tool.name)).toEqual([
    ...tools
      .filter((tool) => (tool.annotations as string[]).includes('read_only'))
      .map((tool) => tool.name),
    ...DOCS_TOOLS,
  ])
  const annotations = (name: string) =>
    operations.find((tool: { name: string }) => tool.name === name).annotations
  expect(annotations('subscriptions_list')).toEqual({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  })
  expect(annotations('subscriptions_update')).toMatchObject({
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  })
  expect(annotations('benefit_grants_list').readOnlyHint).toBe(true)
  expect(annotations('webhooks_create_webhook_endpoint').openWorldHint).toBe(
    true,
  )
})

test('initialize returns instructions for the tool mode', async () => {
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
  const codeMode = (await initialize('')).result.instructions
  expect(codeMode).toContain('aggregate in code')
  expect(codeMode).toContain('`execute`')
  const operations = (await initialize('?codemode=false')).result.instructions
  expect(operations).toContain('aggregate in code')
  expect(operations).not.toContain('`execute`')
})

test('search and execute preserve sandbox isolation, outbound credentials, and limits', async () => {
  const code = 'async () => 42'
  expect(
    (await rpc('tools/call', { name: 'search', arguments: { code } })).result
      .content,
  ).toEqual([{ type: 'text', text: 'sandbox result' }])
  const search = get.mock.calls[0][1]()
  expect(search.globalOutbound).toBeNull()
  expect(search.limits).toEqual({ cpuMs: 5_000, subRequests: 0 })
  expect(search.modules['spec.json']).toBeDefined()
  expect(search.modules['worker.js']).toContain(`(${code})()`)
  await rpc(
    'tools/call',
    { name: 'execute', arguments: { code } },
    '?readonly=true',
  )
  const execute = get.mock.calls[1][1]()
  expect(execute.limits).toEqual({ cpuMs: 10_000, subRequests: 50 })
  expect(execute.globalOutbound).not.toBeNull()
  expect(execute.modules['worker.js']).not.toContain('polar_oat_test')
  expect(exports.PolarApiOutbound).toHaveBeenCalledWith({
    props: {
      apiUrl: 'https://api.polar.test',
      token: 'polar_oat_test',
      readOnly: true,
    },
  })
  const missing = await rpc('tools/call', { name: 'execute', arguments: {} })
  expect(missing.result?.isError ?? !!missing.error).toBe(true)
})

test('the execute sandbox client serializes requests and handles every kind of response', async () => {
  await rpc('tools/call', {
    name: 'execute',
    arguments: {
      code: `async () => {
        const list = await polar.request({
          path: '/v1/products/',
          query: { metadata: { tier: 'pro' }, organization_id: ['a', 'b'], limit: 10, skipped: undefined },
        })
        const created = await polar.request({ method: 'POST', path: '/v1/products/', body: { name: 'Pro' } })
        const text = await polar.request({ path: '/v1/files/' })
        const empty = await polar.request({ method: 'DELETE', path: '/v1/products/1' })
        const failure = await polar.request({ path: '/v1/products/2' }).catch(({ message, status }) => ({ message, status }))
        const offline = await polar.request({ path: '/v1/orders/' }).catch(({ message }) => message)
        return { list, created, text, empty, failure, offline }
      }`,
    },
  })
  const source = get.mock.calls[0][1]().modules['worker.js'] as string
  const sandboxFetch = vi.fn<typeof fetch>()
  sandboxFetch
    .mockResolvedValueOnce(Response.json({ items: [] }))
    .mockResolvedValueOnce(Response.json({ id: 'product' }, { status: 201 }))
    .mockResolvedValueOnce(new Response('plain text'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      Response.json({ detail: 'Not found' }, { status: 404 }),
    )
    .mockRejectedValueOnce(new Error('network down'))
  const Worker = runInThisContext(
    `(WorkerEntrypoint, globalThis) => {${source
      .replace("import { WorkerEntrypoint } from 'cloudflare:workers'", '')
      .replace('export default', 'return')}}`,
  )(class {}, { fetch: sandboxFetch })
  const { result, error, requests, calls } = await new Worker().evaluate()
  expect(error).toBeUndefined()
  expect(requests).toBe(6)
  expect(JSON.parse(result)).toEqual({
    list: { items: [] },
    created: { id: 'product' },
    text: 'plain text',
    empty: null,
    failure: { message: 'Polar API 404: {"detail":"Not found"}', status: 404 },
    offline: 'network down',
  })
  expect(
    calls.map(({ method, url, status }: Record<string, unknown>) => [
      method,
      new URL(url as string).pathname,
      status,
    ]),
  ).toEqual([
    ['GET', '/v1/products/', 200],
    ['POST', '/v1/products/', 201],
    ['GET', '/v1/files/', 200],
    ['DELETE', '/v1/products/1', 204],
    ['GET', '/v1/products/2', 404],
    ['GET', '/v1/orders/', 0],
  ])

  const [listUrl, listInit] = sandboxFetch.mock.calls[0]
  const url = listUrl as URL
  expect(url.origin + url.pathname).toBe('https://api.polar.test/v1/products/')
  expect([...url.searchParams]).toEqual([
    ['metadata[tier]', 'pro'],
    ['organization_id', 'a'],
    ['organization_id', 'b'],
    ['limit', '10'],
  ])
  expect(listInit).toEqual({ method: 'GET', headers: {}, body: undefined })

  const [createUrl, createInit] = sandboxFetch.mock.calls[1]
  expect((createUrl as URL).href).toBe('https://api.polar.test/v1/products/')
  expect(createInit).toEqual({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":"Pro"}',
  })
})

test('sandbox failures become tool errors and long errors and results are truncated', async () => {
  evaluate.mockRejectedValueOnce(new Error('sandbox failed'))
  expect(
    (
      await rpc('tools/call', {
        name: 'search',
        arguments: { code: 'async () => 1' },
      })
    ).result,
  ).toEqual({
    content: [{ type: 'text', text: 'Error: sandbox failed' }],
    isError: true,
  })
  evaluate.mockResolvedValueOnce({ error: 'x'.repeat(24_001) })
  expect(
    (
      await rpc('tools/call', {
        name: 'search',
        arguments: { code: 'async () => 1' },
      })
    ).result.content[0].text,
  ).toContain('--- TRUNCATED ---')
  evaluate.mockResolvedValueOnce({ result: 'x'.repeat(24_001) })
  const result = (
    await rpc('tools/call', {
      name: 'search',
      arguments: { code: 'async () => 1' },
    })
  ).result
  expect(result.content[0].text).toBe(
    `${'x'.repeat(24_000)}\n\n--- TRUNCATED ---\nThe result was 24001 characters (limit 24000). Return fewer fields or items.`,
  )
})

test('operation results are not truncated and the text is the serialized structured content', async () => {
  const items = Array.from({ length: 1_000 }, (_, index) => ({
    id: `order-${index}`,
    description: 'Monthly Pro',
  }))
  fetchMock.mockResolvedValueOnce(Response.json({ items }))
  const { result } = await rpc(
    'tools/call',
    { name: 'orders_list', arguments: {} },
    '?codemode=false',
  )
  expect(result.content[0].text).toBe(JSON.stringify({ items }))
  expect(result.structuredContent).toEqual({ items })
})

test('every MCP request logs one line without the token, arguments or results', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  fetchMock.mockResolvedValueOnce(
    Response.json({ detail: 'jane@example.com not found' }, { status: 404 }),
  )
  await rpc(
    'tools/call',
    { name: 'customers_get', arguments: { id: 'customer-id' } },
    '?codemode=false&readonly=true',
    { 'User-Agent': 'claude-code/3.0' },
  )
  evaluate.mockResolvedValueOnce({ result: 'x'.repeat(30_000), requests: 3 })
  await rpc('tools/call', {
    name: 'execute',
    arguments: { code: 'async () => "secret code"' },
    _meta: {
      'io.modelcontextprotocol/clientInfo': { name: 'codex', version: '1.2' },
    },
  })
  evaluate.mockRejectedValueOnce(new Error('Worker exceeded CPU time limit.'))
  await rpc('tools/call', { name: 'execute', arguments: { code: 'x' } })

  const entries = log.mock.calls.map(([entry]) => entry)
  const base = {
    event: 'mcp.request',
    server: 'polar-mcp',
    telemetry: true,
    subject: expect.stringMatching(/^[0-9a-f]{32}$/),
    rpcMethod: 'tools/call',
    status: 200,
    durationMs: expect.any(Number),
  }
  expect(entries).toEqual([
    {
      ...base,
      mode: 'operations',
      readOnly: true,
      userAgent: 'claude-code/3.0',
      message: 'polar-mcp tools/call customers_get 200',
      tool: 'customers_get',
      isError: true,
      errorKind: 'api',
      apiStatus: 404,
      apiRequests: 1,
      apiOperations: ['GET /v1/customers/{id} 404'],
    },
    {
      ...base,
      mode: 'codemode',
      readOnly: false,
      userAgent: null,
      message: 'polar-mcp tools/call execute 200',
      tool: 'execute',
      client: { name: 'codex', version: '1.2' },
      isError: false,
      resultChars: 30_000,
      truncated: true,
      emptyResult: false,
      apiRequests: 3,
    },
    {
      ...base,
      mode: 'codemode',
      readOnly: false,
      userAgent: null,
      message: 'polar-mcp tools/call execute 200',
      tool: 'execute',
      isError: true,
      errorKind: 'sandbox',
      errorMessage: 'Worker exceeded CPU time limit.',
    },
  ])
  const logged = JSON.stringify(entries)
  for (const secret of [
    'polar_oat_test',
    'customer-id',
    'jane@',
    'secret code',
  ]) {
    expect(logged).not.toContain(secret)
  }
  log.mockRestore()
})

test('code mode logs the operations a call hit and tells API failures from script errors', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  evaluate.mockResolvedValueOnce({
    error: 'Polar API 422: {"detail":"jane@example.com is invalid"}',
    errorName: 'Error',
    status: 422,
    body: {
      detail: [
        {
          loc: ['body', 'prices', 0, 'price_amount'],
          msg: 'jane@example.com is invalid',
          type: 'int_parsing',
        },
        {
          loc: ['body', 'metadata', 'plan'],
          msg: 'Input should be a valid string',
          type: 'string_type',
        },
        {
          loc: ['body', 'metadata', 'jane@example.com'],
          msg: 'Input should be a valid string',
          type: 'string_type',
        },
      ],
    },
    requests: 2,
    calls: [
      null as never,
      {
        method: 'GET',
        url: 'https://api.polar.test/v1/products/00000000-0000-4000-8000-000000000001',
        status: 200,
      },
      {
        method: 'POST',
        url: 'https://api.polar.test/v1/customers/',
        status: 422,
      },
    ],
  })
  await rpc('tools/call', { name: 'execute', arguments: { code: 'x' } })
  evaluate.mockResolvedValueOnce({
    error: 'items is not iterable',
    errorName: 'TypeError',
    requests: 1,
    calls: [
      {
        method: 'GET',
        url: 'https://api.polar.test/v1/customers/jane@example.com/bogus',
        status: 403,
      },
    ],
  })
  await rpc('tools/call', { name: 'execute', arguments: { code: 'x' } })
  evaluate.mockResolvedValueOnce({ result: '[]' })
  await rpc('tools/call', { name: 'search', arguments: { code: 'x' } })
  fetchMock.mockResolvedValueOnce(
    Response.json(
      {
        detail: [
          {
            loc: ['query', 'limit'],
            msg: 'Input should be less than or equal to 100',
            type: 'less_than_equal',
          },
        ],
      },
      { status: 422 },
    ),
  )
  await rpc(
    'tools/call',
    { name: 'products_list', arguments: {} },
    '?codemode=false',
  )
  evaluate.mockResolvedValueOnce({
    error: 'boom',
    errorName: 'jane@example.com',
  })
  await rpc('tools/call', { name: 'execute', arguments: { code: 'x' } })

  const [
    apiFailure,
    scriptFailure,
    emptySearch,
    operationFailure,
    unknownErrorFailure,
  ] = log.mock.calls.map(([entry]) => entry)
  expect(unknownErrorFailure).toMatchObject({ errorKind: 'script' })
  expect(unknownErrorFailure).not.toHaveProperty('scriptError')
  expect(operationFailure).toMatchObject({
    tool: 'products_list',
    errorKind: 'api',
    apiStatus: 422,
    apiErrorFields: ['query.limit less_than_equal'],
  })
  expect(apiFailure).toMatchObject({
    isError: true,
    errorKind: 'api',
    apiStatus: 422,
    apiOperations: ['GET /v1/products/{id} 200', 'POST /v1/customers/ 422'],
    apiErrorFields: [
      'body.prices.0.price_amount int_parsing',
      'body.metadata.plan string_type',
      'body.metadata.{} string_type',
    ],
  })
  expect(apiFailure).not.toHaveProperty('scriptError')
  expect(apiFailure).not.toHaveProperty('errorMessage')
  expect(apiFailure).not.toHaveProperty('scriptErrorMessage')
  expect(scriptFailure).toMatchObject({
    isError: true,
    errorKind: 'script',
    scriptError: 'TypeError',
    unexposedOperations: ['GET /v1/customers/{}/{}'],
  })
  expect(scriptFailure).not.toHaveProperty('errorMessage')
  expect(scriptFailure).not.toHaveProperty('scriptErrorMessage')
  expect(emptySearch).toMatchObject({ isError: false, emptyResult: true })
  expect(JSON.stringify(log.mock.calls)).not.toContain('jane@')
  log.mockRestore()
})

test('tool calls are sent to PostHog as $mcp_tool_call events without the token, arguments or results, unless ?telemetry=false', async () => {
  env.POSTHOG_PROJECT_KEY = 'phc_test'
  waitUntil.mockClear()
  const auth = { Authorization: 'Bearer polar_oat_capture' }
  const call = (params: Record<string, unknown>, query = '') =>
    rpc('tools/call', params, query, auth)
  try {
    fetchMock.mockResolvedValueOnce(
      Response.json({ items: [{ id: 'org-capture' }] }),
    )
    await rpc('tools/list', {}, '', auth)
    evaluate.mockResolvedValueOnce({
      result: '"secret result"',
      requests: 1,
      calls: [
        {
          method: 'GET',
          url: 'https://api.polar.test/v1/products/',
          status: 200,
        },
      ],
    })
    await call({
      name: 'execute',
      arguments: { code: 'async () => "secret code"' },
    })
    await call({ name: 'execute', arguments: {} })
    evaluate.mockResolvedValueOnce({
      error: 'Polar API 404: not an operation exposed by this server',
      status: 404,
      requests: 1,
      calls: [
        {
          method: 'GET',
          url: 'https://api.polar.test/v1/oauth2/userinfo',
          status: 404,
        },
      ],
    })
    await call({ name: 'execute', arguments: { code: 'x' } })
    for (const value of ['false', '0', 'OFF', 'no']) {
      await call(
        { name: 'execute', arguments: { code: 'x' } },
        `?telemetry=${value}`,
      )
    }
    await rpc('tools/call', { name: 'execute', arguments: { code: 'x' } }, '', {
      ...auth,
      'User-Agent': 'claude-code/2.1.0 (darwin)',
    })
    await call({ name: 'jane@example.com', arguments: { code: 'x' } })
    env.MCP_ANALYTICS_SECRET = ''
    await call({ name: 'execute', arguments: { code: 'x' } })

    const events = fetchMock.mock.calls
      .filter(([url]) => url === 'https://us.i.posthog.com/capture/')
      .map(([, init]) => JSON.parse(init!.body as string))
    expect(events).toHaveLength(5)
    expect(waitUntil).toHaveBeenCalledTimes(5)
    expect(events[3].properties).toMatchObject({
      $mcp_client_name: 'claude-code',
      $mcp_client_version: '2.1.0',
      user_agent: 'claude-code/2.1.0 (darwin)',
    })
    expect(events[4].properties).toMatchObject({
      $mcp_tool_name: 'unknown',
      $mcp_is_error: true,
    })
    expect(events[0]).toEqual({
      api_key: 'phc_test',
      event: '$mcp_tool_call',
      distinct_id: `mcp:${createHmac('sha256', 'analytics-secret-test').update('organization:org-capture').digest('hex').slice(0, 32)}`,
      properties: expect.objectContaining({
        $mcp_tool_name: 'execute',
        $mcp_is_error: false,
        $mcp_server_name: 'polar',
        server: 'polar-mcp',
        mode: 'codemode',
        api_requests: 1,
        api_operations: ['GET /v1/products/ 200'],
        $process_person_profile: false,
        $geoip_disable: true,
      }),
    })
    expect(events[1].properties).toMatchObject({
      $mcp_tool_name: 'execute',
      $mcp_is_error: true,
      $mcp_error_type: 'validation',
    })
    expect(events[2].properties).toMatchObject({
      $mcp_error_status: 404,
      $mcp_error_type: 'api_4xx',
      unexposed_operations: ['GET /v1/oauth2/userinfo'],
    })
    expect(events[1].distinct_id).toBe(events[0].distinct_id)
    const sent = JSON.stringify(events)
    for (const secret of [
      'polar_oat_capture',
      'org-capture',
      'secret code',
      'secret result',
      'jane@',
    ]) {
      expect(sent).not.toContain(secret)
    }
  } finally {
    env.POSTHOG_PROJECT_KEY = ''
    env.MCP_ANALYTICS_SECRET = 'analytics-secret-test'
  }
})

test('only engine errors from search scripts send their message to PostHog', async () => {
  env.POSTHOG_PROJECT_KEY = 'phc_test'
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const search = () =>
    rpc('tools/call', { name: 'search', arguments: { code: 'x' } })
  const execute = () =>
    rpc('tools/call', { name: 'execute', arguments: { code: 'x' } })
  try {
    evaluate.mockResolvedValueOnce({
      error: "Cannot read properties of undefined (reading 'post')",
      errorName: 'TypeError',
    })
    await search()
    evaluate.mockResolvedValueOnce({
      error: 'x'.repeat(1_500),
      errorName: 'TypeError',
    })
    await search()
    evaluate.mockRejectedValueOnce(new Error('Worker exceeded CPU time limit.'))
    await search()
    evaluate.mockResolvedValueOnce({
      error: 'jane@example.com not found',
      errorName: 'Error',
    })
    await search()
    evaluate.mockResolvedValueOnce({
      error: 'jane@example.com is not iterable',
      errorName: 'TypeError',
    })
    await execute()
    evaluate.mockResolvedValueOnce({
      error: 'Polar API 404: {"detail":"jane@example.com not found"}',
      errorName: 'Error',
      status: 404,
    })
    await execute()

    const [searchScript, , searchSandbox, searchThrown, ...executeFailures] =
      log.mock.calls.map(([entry]) => entry)
    expect(searchScript).toMatchObject({
      errorKind: 'script',
      scriptError: 'TypeError',
      scriptErrorMessage:
        "Cannot read properties of undefined (reading 'post')",
    })
    expect(searchSandbox).toMatchObject({ errorKind: 'sandbox' })
    expect(searchSandbox).not.toHaveProperty('scriptErrorMessage')
    expect(searchThrown).toMatchObject({ errorKind: 'script' })
    expect(searchThrown).not.toHaveProperty('scriptErrorMessage')
    expect(executeFailures).toHaveLength(2)
    for (const entry of executeFailures) {
      expect(entry).not.toHaveProperty('scriptErrorMessage')
    }

    const events = fetchMock.mock.calls
      .filter(([url]) => url === 'https://us.i.posthog.com/capture/')
      .map(([, init]) => JSON.parse(init!.body as string).properties)
    expect(events).toHaveLength(6)
    expect(events[0]).toMatchObject({
      $mcp_tool_name: 'search',
      $mcp_error_message:
        "Cannot read properties of undefined (reading 'post')",
    })
    expect(events[1].$mcp_error_message).toBe('x'.repeat(1_000))
    for (const event of events.slice(2)) {
      expect(event).not.toHaveProperty('$mcp_error_message')
    }
    expect(JSON.stringify([log.mock.calls, events])).not.toContain('jane@')
  } finally {
    env.POSTHOG_PROJECT_KEY = ''
    log.mockRestore()
  }
})

test('every tool the server registers is reported to PostHog under its own name', async () => {
  for (const query of ['', '?codemode=false']) {
    const { tools } = (await rpc('tools/list', {}, query)).result
    for (const { name } of tools) {
      expect(toolNames.has(name)).toBe(true)
    }
  }
})

test('the analytics id is a keyed hash of the account, so a refreshed token keeps it', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const hash = (account: string) =>
    createHmac('sha256', 'analytics-secret-test')
      .update(account)
      .digest('hex')
      .slice(0, 32)
  for (const [token, body] of [
    ['polar_at_u_first', { sub: 'user-1' }],
    ['polar_at_u_refreshed', { sub: 'user-1' }],
    ['polar_at_o_app', { sub: 'org-1' }],
    ['polar_oat_without_read_scope', undefined],
  ] as const) {
    fetchMock.mockResolvedValueOnce(
      body ? Response.json(body) : new Response(null, { status: 403 }),
    )
    await rpc('tools/list', {}, '', { Authorization: `Bearer ${token}` })
  }
  expect(log.mock.calls.map(([entry]) => entry.subject)).toEqual([
    hash('user:user-1'),
    hash('user:user-1'),
    hash('organization:org-1'),
    hash('token:polar_oat_without_read_scope'),
  ])
  log.mockRestore()
})

test('operation tools preserve query serialization, credentials, JSON results and errors', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ items: [{ id: 'product' }] }))
  const result = await rpc(
    'tools/call',
    {
      name: 'products_list',
      arguments: {
        limit: 10,
        is_archived: false,
        organization_id: ['11111111-1111-4111-8111-111111111111'],
        metadata: { tier: 'pro' },
      },
    },
    '?codemode=false',
  )
  expect(result.result.content[0].text).toBe(
    JSON.stringify({ items: [{ id: 'product' }] }),
  )
  expect(result.result.structuredContent).toEqual({
    items: [{ id: 'product' }],
  })
  const [input, init] = fetchMock.mock.calls[0]
  const url = new URL(input instanceof Request ? input.url : input)
  expect(url.pathname).toBe('/v1/products/')
  expect(url.searchParams.get('limit')).toBe('10')
  expect(url.searchParams.get('is_archived')).toBe('false')
  expect(url.searchParams.get('metadata[tier]')).toBe('pro')
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer polar_oat_test',
  )
  expect(new Headers(init?.headers).get('User-Agent')).toBe('polar-mcp')
  expect(new Headers(init?.headers).get('Polar-Version')).toBe(spec.apiVersion)
  fetchMock.mockResolvedValueOnce(new Response('denied', { status: 403 }))
  expect(
    (
      await rpc(
        'tools/call',
        { name: 'products_list', arguments: {} },
        '?codemode=false',
      )
    ).result,
  ).toEqual({
    content: [{ type: 'text', text: 'Error: Polar API 403: denied' }],
    isError: true,
  })
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
  expect(
    (
      await rpc(
        'tools/call',
        { name: 'products_list', arguments: {} },
        '?codemode=false',
      )
    ).result.content[0].text,
  ).toBe('No content')
})

test('docs tools search Mintlify and read pages as markdown from the docs site', async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json([
      {
        path: '/features/checkout/links',
        content: 'Create a checkout link',
        metadata: { title: 'Checkout Links' },
      },
      {
        path: 'https://polar.sh/docs/integrate/sdk/adapters/nextjs#checkout',
        content: 'Next.js checkout',
      },
    ]),
  )
  const search = await rpc('tools/call', {
    name: 'search_docs',
    arguments: { query: 'checkout links' },
  })
  expect(search.result.content[0].text).toBe(
    [
      '## Checkout Links\nPage: features/checkout/links\nURL: https://polar.sh/docs/features/checkout/links\n\nCreate a checkout link',
      '## integrate/sdk/adapters/nextjs\nPage: integrate/sdk/adapters/nextjs\nURL: https://polar.sh/docs/integrate/sdk/adapters/nextjs\n\nNext.js checkout',
    ].join('\n\n---\n\n'),
  )
  const [input, init] = fetchMock.mock.calls[0]
  expect(input instanceof Request ? input.url : String(input)).toBe(
    'https://api.mintlify.com/discovery/v1/search/polar',
  )
  expect(init?.method).toBe('POST')
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer mint_dsc_test',
  )
  expect(
    JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)),
  ).toEqual({ query: 'checkout links', pageSize: 8 })

  fetchMock.mockResolvedValueOnce(new Response('# Checkout Links'))
  expect(
    (
      await rpc('tools/call', {
        name: 'read_docs_page',
        arguments: { page: '/features/checkout/links.mdx' },
      })
    ).result.content[0].text,
  ).toBe('# Checkout Links')
  const [page] = fetchMock.mock.calls[1]
  expect(page instanceof Request ? page.url : String(page)).toBe(
    'https://polar.sh/docs/features/checkout/links.md',
  )

  fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }))
  const missing = await rpc('tools/call', {
    name: 'read_docs_page',
    arguments: { page: 'missing' },
  })
  expect(missing.result.isError).toBe(true)
  expect(missing.result.content[0].text).toContain('404')

  const outside = await rpc('tools/call', {
    name: 'read_docs_page',
    arguments: { page: 'https://polar.sh/docs/http:evil.example' },
  })
  expect(outside.result).toEqual({
    content: [
      {
        type: 'text',
        text: 'Error: Not a Polar docs page: https://polar.sh/docs/http:evil.example',
      },
    ],
    isError: true,
  })
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

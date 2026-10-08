import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CLIENT_INFO_META_KEY } from '@modelcontextprotocol/server'
import { request, rpc } from './client'
import tools from '../src/generated/tools.json'
import { evaluate, exports, get } from './workers'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue(Response.json({ items: [] }))
  evaluate.mockReset().mockResolvedValue({ result: 'sandbox result' })
  get.mockClear()
  exports.PolarApiOutbound.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

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
    bearer_methods_supported: ['header'],
    resource_name: 'Polar',
  })
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
      'Bearer resource_metadata="https://mcp.polar.test/.well-known/oauth-protected-resource/mcp/polar-mcp"',
    )
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test('OAuth validates per environment, caches for 60 seconds, and does not cache 401s', async () => {
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
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }))
  await request('/mcp/polar-mcp', { headers })
  await request('/mcp/polar-mcp', { headers })
  expect(fetchMock).toHaveBeenCalledTimes(5)
})

test('code mode is the default; client hints and explicit overrides select operation mode', async () => {
  const defaultTools = (await rpc('tools/list')).result.tools
  expect(defaultTools.map((tool: { name: string }) => tool.name)).toEqual([
    'search',
    'execute',
  ])
  expect(defaultTools[0].inputSchema.properties.code.type).toBe('string')
  expect(defaultTools[0].inputSchema.required).toEqual(['code'])
  const operations = (
    await rpc('tools/list', {}, '', { 'User-Agent': 'claude-code/1.0' })
  ).result.tools
  expect(operations.map((tool: { name: string }) => tool.name)).toEqual(
    tools.map((tool) => tool.name),
  )
  expect(
    (
      await rpc('tools/list', {}, '?codemode=true', {
        'User-Agent': 'Cursor/1.0',
      })
    ).result.tools,
  ).toHaveLength(2)
  const meta = {
    _meta: { [CLIENT_INFO_META_KEY]: { name: 'codex-mcp-client' } },
  }
  expect((await rpc('tools/list', meta)).result.tools).toHaveLength(
    tools.length,
  )
  expect(
    (await rpc('tools/list', meta, '?codemode=true')).result.tools,
  ).toHaveLength(2)
  const readOnly = (
    await rpc('tools/list', {}, '?codemode=false&readonly=true')
  ).result.tools
  expect(readOnly.map((tool: { name: string }) => tool.name)).toEqual(
    tools.filter((tool) => tool.method === 'GET').map((tool) => tool.name),
  )
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

test('sandbox failures become tool errors and successful results are truncated', async () => {
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
    JSON.stringify({ items: [{ id: 'product' }] }, null, 2),
  )
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

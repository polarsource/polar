import { customers } from '@polar-sh/cli-commands'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as ApiRuntime from '@/services/api-runtime'
import { Auth } from '@/services/auth'
import * as Polar from '@/services/polar'
import { runCli } from '@/utils/test-utils/cli'
import { fakeAuth } from '@/utils/test-utils/services'

let requests: Request[]
let auth: ReturnType<typeof fakeAuth>
let response: Response

beforeEach(() => {
  requests = []
  auth = fakeAuth()
  response = Response.json({ id: 'customer-1' })
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return Promise.resolve(response.clone())
  })
})

afterEach(() => vi.unstubAllGlobals())

const run = (args: string[]) => {
  const cli = runCli(customers, args)
  const runtime = ApiRuntime.layer.pipe(
    Layer.provide(Polar.layer),
    Layer.provide(Layer.succeed(Auth, auth.auth)),
  )
  return {
    ...cli,
    promise: Effect.runPromise(cli.effect.pipe(Effect.provide(runtime))),
  }
}

describe('generated customer commands', () => {
  test.each([
    { args: ['list'], method: 'GET', path: '/v1/customers/' },
    {
      args: ['create', '--email=alice@example.com'],
      method: 'POST',
      path: '/v1/customers/',
    },
    {
      args: ['get', 'customer-1'],
      method: 'GET',
      path: '/v1/customers/customer-1',
    },
    {
      args: ['update', 'customer-1', '--name=Alice'],
      method: 'PATCH',
      path: '/v1/customers/customer-1',
    },
    {
      args: ['delete', 'customer-1', '--confirm'],
      method: 'DELETE',
      path: '/v1/customers/customer-1',
    },
    {
      args: ['get_external', 'user/123'],
      method: 'GET',
      path: '/v1/customers/external/user%2F123',
    },
    {
      args: ['update_external', 'user-1', '--name=Alice'],
      method: 'PATCH',
      path: '/v1/customers/external/user-1',
    },
    {
      args: ['delete_external', 'user-1', '-c'],
      method: 'DELETE',
      path: '/v1/customers/external/user-1',
    },
    {
      args: ['get_state', 'customer-1'],
      method: 'GET',
      path: '/v1/customers/customer-1/state',
    },
    {
      args: ['get_state_external', 'user-1'],
      method: 'GET',
      path: '/v1/customers/external/user-1/state',
    },
    {
      args: ['list_payment_methods', 'customer-1'],
      method: 'GET',
      path: '/v1/customers/customer-1/payment-methods',
    },
    {
      args: ['list_payment_methods_external', 'user-1'],
      method: 'GET',
      path: '/v1/customers/external/user-1/payment-methods',
    },
  ])('$args uses the generated SDK binding', async ({ args, method, path }) => {
    await run(args).promise
    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe(method)
    expect(new URL(requests[0]!.url).pathname).toBe(path)
    expect(requests[0]!.headers.get('Polar-Version')).toBe('2026-04')
  })

  test('list preserves explicit false and repeated filters', async () => {
    const cli = run([
      'list',
      '--active=false',
      '--email=alice@example.com',
      '--org=org-1',
      '--org=org-2',
      '--sorting=-email',
      '--sorting=name',
      '--page=2',
      '--limit=20',
      '--metadata={"source":"cli"}',
    ])
    await cli.promise
    const url = new URL(requests[0]!.url)
    expect(url.origin).toBe('https://sandbox-api.polar.sh')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      email: 'alice@example.com',
      active: 'false',
      page: '2',
      limit: '20',
      'metadata[source]': 'cli',
    })
    expect(url.searchParams.getAll('organization_id')).toEqual([
      'org-1',
      'org-2',
    ])
    expect(url.searchParams.getAll('sorting')).toEqual(['-email', 'name'])
    expect(auth.state.resolutions[0]!.environment).toBe('sandbox')
    expect(requests[0]!.headers.get('Authorization')).toBe('Bearer token')
    expect(JSON.parse(cli.output())).toEqual({ id: 'customer-1' })
  })

  test('omitted booleans stay omitted', async () => {
    await run(['list']).promise
    const url = new URL(requests[0]!.url)
    expect(url.origin).toBe('https://sandbox-api.polar.sh')
    expect(url.searchParams.has('active')).toBe(false)
  })

  test('JSON query input combines with explicit flags', async () => {
    await run([
      'list',
      '-d',
      '{"email":"old@example.com","active":true}',
      '--email=new@example.com',
    ]).promise
    const query = new URL(requests[0]!.url).searchParams
    expect(query.get('email')).toBe('new@example.com')
    expect(query.get('active')).toBe('true')
  })

  test('create combines generated scalar flags with nested JSON', async () => {
    await run([
      'create',
      '--email=alice@example.com',
      '--type=individual',
      '--org=org-1',
      '-d',
      '{"name":"Alice","metadata":{"source":"cli"},"billing_address":{"country":"US"}}',
    ]).promise
    expect(await requests[0]!.json()).toEqual({
      email: 'alice@example.com',
      type: 'individual',
      organization_id: 'org-1',
      name: 'Alice',
      metadata: { source: 'cli' },
      billing_address: { country: 'US' },
    })
  })

  test('update preserves null and replaces nested JSON shallowly', async () => {
    await run([
      'update',
      'customer-1',
      '-d',
      '{"name":null,"metadata":{"old":"value"}}',
      '--metadata={"new":"value"}',
      '--email=',
    ]).promise
    expect(await requests[0]!.json()).toEqual({
      name: null,
      metadata: { new: 'value' },
      email: '',
    })
  })

  test('delete requires explicit confirmation before authentication', async () => {
    await expect(run(['delete', 'customer-1']).promise).rejects.toThrow(
      '--confirm',
    )
    expect(requests).toHaveLength(0)
    expect(auth.state.resolutions).toHaveLength(0)
  })

  test('confirmed delete forwards anonymize and prints nothing for 204', async () => {
    response = new Response(null, { status: 204 })
    const cli = run(['delete', 'customer-1', '--confirm', '--anonymize'])
    await cli.promise
    expect(new URL(requests[0]!.url).searchParams.get('anonymize')).toBe('true')
    expect(cli.output()).toBe('')
  })

  test.each(['not-json', '[]', '[{}]', 'null', '42', 'true', '"text"'])(
    'rejects invalid --data %s without sending',
    async (data) => {
      await expect(run(['create', '-d', data]).promise).rejects.toThrow()
      expect(requests).toHaveLength(0)
    },
  )

  test('help works without authenticating or calling the API', async () => {
    const cli = run(['list', '--help'])
    await cli.promise
    expect(cli.output()).toContain('--email')
    expect(cli.output()).toContain('--active')
    expect(auth.state.resolutions).toHaveLength(0)
    expect(requests).toHaveLength(0)
  })

  test('API failures reject rather than printing a success payload', async () => {
    response = Response.json({ detail: 'Invalid customer' }, { status: 422 })
    const cli = run(['create', '--email=invalid'])
    await expect(cli.promise).rejects.toThrow('Polar API request failed')
    expect(cli.output()).toBe('')
  })
})

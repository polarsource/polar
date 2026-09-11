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

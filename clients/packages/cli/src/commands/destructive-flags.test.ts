import { products } from '@polar-sh/cli-commands'
import { Effect, Layer } from 'effect'
import { Prompt } from 'effect/unstable/cli'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as ApiRuntime from '@/services/api-runtime'
import { Auth } from '@/services/auth'
import * as Polar from '@/services/polar'
import { runCli } from '@/utils/test-utils/cli'
import { fakeAuth } from '@/utils/test-utils/services'

vi.mock('effect/unstable/cli', async (importOriginal) => {
  const cli = await importOriginal<typeof import('effect/unstable/cli')>()
  return { ...cli, Prompt: { ...cli.Prompt, run: vi.fn() } }
})

let requests: Request[]
let auth: ReturnType<typeof fakeAuth>

beforeEach(() => {
  requests = []
  auth = fakeAuth()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return Promise.resolve(
      Response.json({ id: 'product-1', name: 'Pro', is_archived: false }),
    )
  })
  vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('yes'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const run = (args: string[], interactive = false) => {
  const cli = runCli(products, ['update', 'product-1', ...args], {
    interactive,
  })
  const runtime = ApiRuntime.layer.pipe(
    Layer.provide(Polar.layer),
    Layer.provide(Layer.succeed(Auth, auth.auth)),
  )
  return {
    ...cli,
    promise: Effect.runPromise(cli.effect.pipe(Effect.provide(runtime))),
  }
}

test.each([
  ['--is-archived=true'],
  ['-d', '{"is_archived":true}'],
  ['-d', '{"is_archived":false}', '--is-archived=true'],
])(
  'archiving with %j previews before confirming and updating',
  async (...args) => {
    vi.mocked(Prompt.run).mockImplementation(() => {
      expect(requests.map(({ method }) => method)).toEqual(['GET'])
      return Effect.succeed('yes')
    })
    const cli = run(args, true)
    await cli.promise
    expect(Prompt.run).toHaveBeenCalledOnce()
    expect(requests.map(({ method }) => method)).toEqual(['GET', 'PATCH'])
    expect(new URL(requests[0]!.url).pathname).toBe('/v1/products/product-1')
    expect(await requests[1]!.json()).toEqual({ is_archived: true })
    expect(cli.output()).toContain('Confirm destructive request')
    expect(cli.output()).toContain('Pro')
    expect(cli.terminal()).toContain('…\n\n')
  },
)

test.each([['--is-archived=true'], ['-d', '{"is_archived":true}']])(
  'archiving with %j requires confirmation without a terminal',
  async (...args) => {
    await expect(run(args).promise).rejects.toThrow('--confirm')
    expect(requests).toHaveLength(0)
    expect(auth.state.resolutions).toHaveLength(0)
  },
)

test.each([
  { args: ['--is-archived=false'], body: { is_archived: false } },
  { args: ['-d', '{"is_archived":false}'], body: { is_archived: false } },
  {
    args: ['-d', '{"is_archived":true}', '--is-archived=false'],
    body: { is_archived: false },
  },
  { args: ['-d', '{"is_archived":null}'], body: { is_archived: null } },
  { args: ['--name=New name'], body: { name: 'New name' } },
])(
  'non-destructive input $args skips preview and confirmation',
  async ({ args, body }) => {
    const cli = run(args)
    await cli.promise
    expect(Prompt.run).not.toHaveBeenCalled()
    expect(cli.terminal()).toBe('')
    expect(requests.map(({ method }) => method)).toEqual(['PATCH'])
    expect(await requests[0]!.json()).toEqual(body)
  },
)

test('rejects a coercible archive value before authentication', async () => {
  await expect(
    run(['-d', '{"is_archived":"true"}', '--confirm']).promise,
  ).rejects.toThrow()
  expect(requests).toHaveLength(0)
  expect(auth.state.resolutions).toHaveLength(0)
})

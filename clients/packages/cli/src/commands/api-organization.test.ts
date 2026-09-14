import { commands } from '@polar-sh/cli-commands'
import { Effect, Layer } from 'effect'
import { Command, Prompt } from 'effect/unstable/cli'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ActiveOrganization } from '@/schemas/Auth'
import * as ApiRuntime from '@/services/api-runtime'
import { Auth } from '@/services/auth'
import { CLIConfig } from '@/services/config'
import * as Organizations from '@/services/organizations'
import * as Polar from '@/services/polar'
import { runCli } from '@/utils/test-utils/cli'
import {
  fakeAuth,
  fakeConfig,
  overrideCredential,
} from '@/utils/test-utils/services'

vi.mock('effect/unstable/cli', async (importOriginal) => {
  const cli = await importOriginal<typeof import('effect/unstable/cli')>()
  return { ...cli, Prompt: { ...cli.Prompt, run: vi.fn() } }
})

const root = Command.make('polar').pipe(Command.withSubcommands(commands))
const production = {
  id: 'org-production',
  name: 'Production',
  slug: 'production',
  environment: 'production' as const,
}
const sandbox = {
  id: 'org-sandbox',
  name: 'Sandbox',
  slug: 'sandbox',
  environment: 'sandbox' as const,
}
let auth: ReturnType<typeof fakeAuth>
let config: ReturnType<typeof fakeConfig>
let organizations: ActiveOrganization[]
let requests: Request[]

beforeEach(() => {
  auth = fakeAuth()
  config = fakeConfig(production)
  organizations = [production, sandbox]
  requests = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    const url = new URL(request.url)
    const environment =
      url.hostname === 'sandbox-api.polar.sh' ? 'sandbox' : 'production'
    const available = organizations.filter(
      (org) => org.environment === environment,
    )
    if (url.pathname === '/v1/organizations/') {
      return Promise.resolve(
        Response.json({
          items: available,
          pagination: { max_page: 1 },
        }),
      )
    }
    if (url.pathname.startsWith('/v1/organizations/')) {
      const organization = available.find((org) =>
        url.pathname.endsWith(`/${org.id}`),
      )
      return Promise.resolve(
        organization
          ? Response.json(organization)
          : Response.json({ detail: 'Not found' }, { status: 404 }),
      )
    }
    return Promise.resolve(Response.json({ id: 'product-1', name: 'Pro' }))
  })
  vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('yes'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const run = (args: string[], interactive = false) => {
  const cli = runCli(root, args, { interactive })
  const dependencies = Layer.mergeAll(
    Layer.succeed(Auth, auth.auth),
    Layer.succeed(CLIConfig, config.config),
  )
  const polar = Polar.layer.pipe(Layer.provide(dependencies))
  const organizations = Organizations.layer.pipe(
    Layer.provide(Layer.mergeAll(polar, dependencies)),
  )
  const runtime = ApiRuntime.layer.pipe(
    Layer.provide(Layer.mergeAll(polar, organizations)),
  )
  return {
    ...cli,
    promise: Effect.runPromise(cli.effect.pipe(Effect.provide(runtime))),
  }
}

test.each([production, sandbox])(
  'uses the selected $environment organization for queries, bodies, and resource IDs',
  async (organization) => {
    config.state.activeOrganization = organization
    await run(['products', 'list']).promise
    expect(
      new URL(requests.at(-1)!.url).searchParams.getAll('organization_id'),
    ).toEqual([organization.id])
    await run(['products', 'create', '--name=Pro']).promise
    expect(await requests.at(-1)!.json()).toEqual({
      organization_id: organization.id,
      name: 'Pro',
    })
    await run(['products', 'update', 'product-1', '--name=Renamed']).promise
    expect(await requests.at(-1)!.json()).toEqual({ name: 'Renamed' })
    expect(
      requests.every(
        (request) =>
          new URL(request.url).hostname ===
          (organization.environment === 'sandbox'
            ? 'sandbox-api.polar.sh'
            : 'api.polar.sh'),
      ),
    ).toBe(true)
    expect(
      auth.state.resolutions.every(
        ({ environment }) => environment === organization.environment,
      ),
    ).toBe(true)
  },
)

test.each([
  ['--org=org-sandbox'],
  ['-d', '{"organization_id":"org-sandbox"}'],
  ['-d', '{"organization_id":"org-production"}', '--org=org-sandbox'],
])(
  'explicit organization input %j does not change the selected environment',
  async (...args) => {
    await run(['products', 'list', ...args]).promise
    const url = new URL(requests.at(-1)!.url)
    expect(url.hostname).toBe('api.polar.sh')
    expect(url.searchParams.getAll('organization_id')).toEqual([sandbox.id])
    expect(requests).toHaveLength(2)
    expect(new URL(requests[0]!.url).pathname).toBe(
      '/v1/organizations/org-production',
    )
    expect(config.state.activeOrganization).toEqual(production)
    expect(config.state.writes).toBe(0)
  },
)

test('repeated organization flags retain every filter within one environment', async () => {
  organizations.push({ ...production, id: 'org-other' })
  await run(['products', 'list', '--org=org-production', '--org=org-other'])
    .promise
  const url = new URL(requests.at(-1)!.url)
  expect(url.hostname).toBe('api.polar.sh')
  expect(url.searchParams.getAll('organization_id')).toEqual([
    production.id,
    'org-other',
  ])
})

test('preserves explicit null instead of injecting the selected organization', async () => {
  await run([
    'customers',
    'create',
    '-d',
    '{"organization_id":null,"email":"test@example.com"}',
  ]).promise
  expect(await requests.at(-1)!.json()).toEqual({
    organization_id: null,
    email: 'test@example.com',
  })
  expect(new URL(requests.at(-1)!.url).hostname).toBe('api.polar.sh')
})

test('previews and mutations share the selected organization environment', async () => {
  const cli = run(
    ['products', 'update', 'product-1', '--is-archived=true'],
    true,
  )
  await cli.promise
  expect(
    requests.map((request) => [request.method, new URL(request.url).pathname]),
  ).toEqual([
    ['GET', '/v1/organizations/org-production'],
    ['GET', '/v1/products/product-1'],
    ['PATCH', '/v1/products/product-1'],
  ])
  expect(
    requests.every(
      (request) => new URL(request.url).hostname === 'api.polar.sh',
    ),
  ).toBe(true)
  expect(cli.output()).toContain('Production')
  expect(cli.output()).toContain('production')
})

test('missing selection fails without silently using sandbox credentials', async () => {
  config.state.activeOrganization = undefined
  await expect(run(['products', 'list']).promise).rejects.toThrow(
    'polar auth org',
  )
  expect(requests).toEqual([])
  expect(auth.state.resolutions).toEqual([])
})

test('stale selection never falls back to another organization', async () => {
  organizations = [sandbox]
  await expect(run(['products', 'list']).promise).rejects.toThrow(
    'missing or inaccessible',
  )
  expect(requests).toHaveLength(1)
  expect(new URL(requests[0]!.url).pathname).toBe(
    '/v1/organizations/org-production',
  )
  expect(config.state.activeOrganization).toEqual(production)
})

test('token override resolves its own organization and environment, ignoring selection', async () => {
  auth.state.credential = overrideCredential()
  auth.state.environment = 'sandbox'
  await run(['products', 'list']).promise
  const url = new URL(requests.at(-1)!.url)
  expect(url.hostname).toBe('sandbox-api.polar.sh')
  expect(url.searchParams.getAll('organization_id')).toEqual([sandbox.id])
  expect(requests.at(-1)!.headers.get('authorization')).toBe('Bearer ci-token')
  expect(config.state.activeOrganization).toEqual(production)
})

test('help requires neither a selected organization nor authentication', async () => {
  config.state.activeOrganization = undefined
  await run(['products', 'list', '--help']).promise
  expect(requests).toEqual([])
  expect(auth.state.resolutions).toEqual([])
})

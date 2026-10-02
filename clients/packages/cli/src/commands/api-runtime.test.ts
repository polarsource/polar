import { commands, products } from '@polar-sh/cli-commands'
import { Effect, Layer } from 'effect'
import { Command, Prompt } from 'effect/unstable/cli'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as ApiRuntime from '@/commands/api-runtime'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { CLIConfig } from '@/services/config'
import * as OrganizationsService from '@/services/organizations'
import * as Polar from '@/services/polar'
import { type RunCliOptions, runCli } from '@/utils/test-utils/cli'
import {
  fakeAuth,
  fakeConfig,
  fakeOrganizations,
  overrideCredential,
} from '@/utils/test-utils/services'

vi.mock('effect/unstable/cli', async (importOriginal) => {
  const cli = await importOriginal<typeof import('effect/unstable/cli')>()
  return { ...cli, Prompt: { ...cli.Prompt, run: vi.fn() } }
})

describe('generated commands', () => {
  const root = Command.make('polar').pipe(Command.withSubcommands(commands))
  let requests: Request[]
  let auth: ReturnType<typeof fakeAuth>

  beforeEach(() => {
    requests = []
    auth = fakeAuth()
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return Promise.resolve(Response.json({ id: 'resource-1' }))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  const run = (args: string[], options: RunCliOptions = {}) => {
    const cli = runCli(root, args, options)
    const organization = {
      id: 'org-1',
      name: 'Selected',
      slug: 'selected',
      environment: 'production' as const,
    }
    const runtime = ApiRuntime.layer.pipe(
      Layer.provide(
        Layer.succeed(
          OrganizationsService.Organizations,
          fakeOrganizations({
            items: [organization],
            selected: organization,
          }).organizations,
        ),
      ),
      Layer.provide(Polar.layer),
      Layer.provide(Layer.succeed(Auth, auth.auth)),
    )
    return {
      ...cli,
      promise: Effect.runPromise(cli.effect.pipe(Effect.provide(runtime))),
    }
  }

  test('keeps the status code of an API failure', async () => {
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return Promise.resolve(
        Response.json({ detail: 'Not found' }, { status: 404 }),
      )
    })
    await expect(
      run(['products', 'get', 'missing-id']).promise,
    ).rejects.toMatchObject({ _tag: 'ApiCommandError', statusCode: 404 })
  })

  describe('required flags', () => {
    test('stops before calling the API and shows an example', async () => {
      await expect(
        run(['products', 'create', '--name', 'Pro']).promise,
      ).rejects.toMatchObject({
        message: 'Missing required flag --prices',
        hint: expect.stringContaining(
          "polar products create --name <name> --prices '[{",
        ),
      })
      expect(requests).toHaveLength(0)
    })

    test('names every missing flag', async () => {
      await expect(run(['products', 'create']).promise).rejects.toThrow(
        'Missing required flags --name, --prices',
      )
    })

    test('sends an explicit null on to the API', async () => {
      await run([
        'products',
        'create',
        '--name',
        'Pro',
        '-d',
        '{"prices":null}',
      ]).promise
      expect(await requests.at(-1)!.json()).toEqual({
        name: 'Pro',
        prices: null,
      })
    })

    test('accepts required values from --data', async () => {
      await run([
        'products',
        'create',
        '--name',
        'Pro',
        '-d',
        '{"prices":[{"amount_type":"fixed","price_amount":1000}]}',
      ]).promise
      expect(await requests.at(-1)!.json()).toEqual({
        name: 'Pro',
        prices: [{ amount_type: 'fixed', price_amount: 1000 }],
      })
    })
  })

  describe('CLI-tagged API commands', () => {
    test.each([
      { args: ['products', 'list'], method: 'GET', path: '/v1/products/' },
      {
        args: ['organizations', 'get', 'org-1'],
        method: 'GET',
        path: '/v1/organizations/org-1',
      },
      {
        args: ['subscriptions', 'revoke', 'sub-1', '--confirm'],
        method: 'DELETE',
        path: '/v1/subscriptions/sub-1',
      },
      {
        args: ['webhooks', 'list_webhook_endpoints'],
        method: 'GET',
        path: '/v1/webhooks/endpoints',
      },
      {
        args: ['license_keys', 'get_activation', 'key-1', 'activation-1'],
        method: 'GET',
        path: '/v1/license-keys/key-1/activations/activation-1',
      },
      {
        args: ['customers', 'members', 'get', 'customer-1', 'member-1'],
        method: 'GET',
        path: '/v1/customers/customer-1/members/member-1',
      },
    ])(
      '$args invokes the matching SDK method',
      async ({ args, method, path }) => {
        await run(args).promise
        expect(requests).toHaveLength(1)
        expect(requests[0]!.method).toBe(method)
        expect(new URL(requests[0]!.url).pathname).toBe(path)
      },
    )

    test('nested member creation keeps path and body external IDs separate', async () => {
      await run([
        'customers',
        'members',
        'create_external',
        'customer/123',
        '--external-id=member-456',
        '--email=member@example.com',
      ]).promise
      expect(new URL(requests[0]!.url).pathname).toBe(
        '/v1/customers/external/customer%2F123/members',
      )
      expect(await requests[0]!.json()).toEqual({
        external_id: 'member-456',
        email: 'member@example.com',
      })
    })

    test.each(['create', 'update'])(
      'benefits %s accepts union discriminator flags',
      async (operation) => {
        await run([
          'benefits',
          operation,
          ...(operation === 'update' ? ['benefit-1'] : []),
          '--type=custom',
          '--description=A custom benefit',
          '--properties={}',
        ]).promise
        expect(await requests[0]!.json()).toEqual({
          type: 'custom',
          description: 'A custom benefit',
          properties: {},
        })
        expect(requests[0]!.headers.get('Polar-Organization')).toBe('org-1')
      },
    )

    test('unauthenticated commands send neither credentials nor an organization', async () => {
      await run(['customer_seats', 'get_claim_info', 'invitation-1']).promise
      expect(requests).toHaveLength(1)
      expect(new URL(requests[0]!.url).pathname).toBe(
        '/v1/customer-seats/claim/invitation-1',
      )
      expect(requests[0]!.headers.get('Authorization')).toBeNull()
      expect(requests[0]!.headers.get('Polar-Organization')).toBeNull()
      expect(auth.state.resolutions).toHaveLength(0)
    })

    test.each([200, 403, 500])(
      'DELETE previews the record, with fallback for GET status %i',
      async (status) => {
        vi.stubGlobal(
          'fetch',
          (input: RequestInfo | URL, init?: RequestInit) => {
            const request = new Request(input, init)
            requests.push(request)
            return Promise.resolve(
              request.method === 'GET'
                ? Response.json({ id: 'customer-1', name: 'Alice' }, { status })
                : new Response(null, { status: 204 }),
            )
          },
        )
        vi.mocked(Prompt.run).mockImplementation(() => {
          expect(requests.map((request) => request.method)).toEqual(['GET'])
          return Effect.succeed('yes')
        })
        const cli = run(['customers', 'delete', 'customer-1', '--anonymize'], {
          interactive: true,
        })
        await cli.promise
        expect(requests.map((request) => request.method)).toEqual([
          'GET',
          'DELETE',
        ])
        expect(new URL(requests[0]!.url).search).toBe('')
        expect(new URL(requests[1]!.url).searchParams.get('anonymize')).toBe(
          'true',
        )
        expect(cli.terminal()).toContain('External ID')
        expect(cli.terminal()).toContain('…\n\n')
        expect(cli.output().includes('Alice')).toBe(status === 200)
        expect(cli.output()).toContain('Confirm destructive request')
      },
    )

    test('a preview 404 exits without prompting or deleting', async () => {
      vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init))
        return Promise.resolve(
          Response.json({ detail: 'Not found' }, { status: 404 }),
        )
      })
      vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('yes'))
      await expect(
        run(['customers', 'delete', 'missing-id'], { interactive: true })
          .promise,
      ).rejects.toMatchObject({
        message: 'Resource does not exist in production.',
        statusCode: 404,
      })
      expect(Prompt.run).not.toHaveBeenCalled()
      expect(requests.map((request) => request.method)).toEqual(['GET'])
    })

    test('cancelling after a preview never sends DELETE', async () => {
      vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('no'))
      await expect(
        run(['customers', 'delete', 'customer-1'], { interactive: true })
          .promise,
      ).rejects.toThrow('Command cancelled.')
      expect(requests.map((request) => request.method)).toEqual(['GET'])
    })

    test.each([
      ['organizations', 'update', 'org-1'],
      ['checkouts', 'create'],
      ['customers', 'export'],
    ])('untagged command %j is unavailable', async (...args) => {
      await expect(run(args).promise).rejects.toThrow()
      expect(requests).toHaveLength(0)
      expect(auth.state.resolutions).toHaveLength(0)
    })

    test('every generated resource and operation renders help without authentication', async () => {
      const queue: { command: Command.Command.Any; args: string[] }[] = [
        { command: root, args: [] },
      ]
      for (const { command, args } of queue) {
        const cli = run([...args, '--help'])
        await cli.promise
        expect(cli.output()).toContain('USAGE')
        expect(cli.output()).not.toContain('--production')
        for (const group of command.subcommands) {
          for (const child of group.commands) {
            queue.push({ command: child, args: [...args, child.name] })
          }
        }
      }
      expect(queue.length).toBeGreaterThan(commands.length)
      expect(requests).toHaveLength(0)
      expect(auth.state.resolutions).toHaveLength(0)
    })
  })
})

describe('destructive flags', () => {
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
    const organization = {
      id: 'org-1',
      name: 'Selected',
      slug: 'selected',
      environment: 'production' as const,
    }
    const runtime = ApiRuntime.layer.pipe(
      Layer.provide(
        Layer.succeed(
          OrganizationsService.Organizations,
          fakeOrganizations({
            items: [organization],
            selected: organization,
          }).organizations,
        ),
      ),
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
})

describe('organization resolution', () => {
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

  const scope = (request: Request) => request.headers.get('Polar-Organization')

  const run = (args: string[], interactive = false) => {
    const cli = runCli(root, args, { interactive })
    const dependencies = Layer.mergeAll(
      Layer.succeed(Auth, auth.auth),
      Layer.succeed(CLIConfig, config.config),
    )
    const polar = Polar.layer.pipe(Layer.provide(dependencies))
    const organizations = OrganizationsService.layer.pipe(
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
    'scopes queries, bodies, and resource IDs to the selected $environment organization',
    async (organization) => {
      config.state.activeOrganization = organization
      await run(['products', 'list']).promise
      expect(
        new URL(requests.at(-1)!.url).searchParams.getAll('organization_id'),
      ).toEqual([])
      await run(['products', 'create', '--name=Pro', '--prices=[]']).promise
      expect(await requests.at(-1)!.json()).toEqual({ name: 'Pro', prices: [] })
      await run(['products', 'update', 'product-1', '--name=Renamed']).promise
      expect(await requests.at(-1)!.json()).toEqual({ name: 'Renamed' })
      expect(requests.map(scope)).toEqual(requests.map(() => organization.id))
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
    { args: ['--org=org-sandbox'], selection: production },
    { args: ['-d', '{"organization_id":"org-sandbox"}'], selection: undefined },
    {
      args: ['-d', '{"organization_id":"org-production"}', '--org=org-sandbox'],
      selection: production,
    },
  ])(
    'explicit organization input $args uses its environment',
    async ({ args, selection }) => {
      config.state.activeOrganization = selection
      await run(['products', 'list', ...args]).promise
      const url = new URL(requests.at(-1)!.url)
      expect(url.hostname).toBe('sandbox-api.polar.sh')
      expect(url.searchParams.getAll('organization_id')).toEqual([sandbox.id])
      expect(requests).toHaveLength(2)
      expect(new URL(requests[0]!.url).pathname).toBe(
        '/v1/organizations/org-sandbox',
      )
      expect(requests.map(scope)).toEqual([sandbox.id, sandbox.id])
      expect(config.state.activeOrganization).toEqual(selection)
      expect(config.state.writes).toBe(0)
    },
  )

  test('repeated organization flags filter by every organization without scoping to one', async () => {
    organizations.push({ ...production, id: 'org-other' })
    await run(['products', 'list', '--org=org-production', '--org=org-other'])
      .promise
    const url = new URL(requests.at(-1)!.url)
    expect(url.hostname).toBe('api.polar.sh')
    expect(url.searchParams.getAll('organization_id')).toEqual([
      production.id,
      'org-other',
    ])
    expect(scope(requests.at(-1)!)).toBeNull()
  })

  test.each([
    { args: ['--org=org-sandbox'], organization: sandbox },
    {
      args: ['-d', '{"organization_id":"org-sandbox"}'],
      organization: sandbox,
    },
    { args: ['-d', '{"organization_id":null}'], organization: production },
  ])(
    'create sends organization input $args only as the Polar-Organization header',
    async ({ args, organization }) => {
      await run(['customers', 'create', '--email=test@example.com', ...args])
        .promise
      expect(await requests.at(-1)!.json()).toEqual({
        email: 'test@example.com',
      })
      expect(new URL(requests.at(-1)!.url).hostname).toBe(
        organization.environment === 'sandbox'
          ? 'sandbox-api.polar.sh'
          : 'api.polar.sh',
      )
      expect(scope(requests.at(-1)!)).toBe(organization.id)
    },
  )

  test('previews and mutations share the selected organization environment', async () => {
    const cli = run(
      ['products', 'update', 'product-1', '--is-archived=true'],
      true,
    )
    await cli.promise
    expect(
      requests.map((request) => [
        request.method,
        new URL(request.url).pathname,
      ]),
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
    expect(requests.map(scope)).toEqual([
      production.id,
      production.id,
      production.id,
    ])
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
    expect(url.searchParams.getAll('organization_id')).toEqual([])
    expect(requests.map(scope)).toEqual([null, sandbox.id])
    expect(requests.at(-1)!.headers.get('authorization')).toBe(
      'Bearer ci-token',
    )
    expect(config.state.activeOrganization).toEqual(production)
  })

  test('help requires neither a selected organization nor authentication', async () => {
    config.state.activeOrganization = undefined
    await run(['products', 'list', '--help']).promise
    expect(requests).toEqual([])
    expect(auth.state.resolutions).toEqual([])
  })
})

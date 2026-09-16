import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, vi } from 'vitest'
import { NodeServices } from '@effect/platform-node'
import { assert, expect, it, layer } from '@effect/vitest'
import { Effect, Layer, Option, Redacted, Schema } from 'effect'
import { TestConsole } from 'effect/testing'
import { HttpClient, HttpClientResponse } from 'effect/unstable/http'
import { ApiLive, VoidConfig } from '../src/api/index'
import {
  checksum,
  compile,
  count,
  defineConfig,
  event,
  meter,
  on,
  sum,
  product,
  recurring,
  usd,
  included,
  signal,
} from '../src/config/index'
import {
  activateDeployment,
  loadConfig,
  reconcile,
  run,
} from '../src/cli/index'
import { config as deploymentConfig } from './fixtures/deployment'

const aiCall = event<{ tokens: number; status: string }>('ai_call')
const config = defineConfig({
  schema: {
    aiCall,
    tokens: meter('tokens', {
      reducer: sum(aiCall, 'tokens'),
      price: { amount: 0.5 },
    }),
    calls: count('calls', on(aiCall, { status: 'ok' })),
  },
})
const ir = compile(config)

const fakeServer = (
  handle: (method: string, path: string, body: unknown) => unknown,
) =>
  HttpClient.make((request, url) =>
    Effect.map(
      request.body._tag === 'Uint8Array'
        ? Effect.succeed(new TextDecoder().decode(request.body.body))
        : Effect.succeed(''),
      (text) =>
        HttpClientResponse.fromWeb(
          request,
          new Response(
            JSON.stringify(
              handle(
                request.method,
                url.pathname,
                text ? JSON.parse(text) : undefined,
              ),
            ),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        ),
    ),
  )

const apiWith = (
  handle: (method: string, path: string, body: unknown) => unknown,
) =>
  ApiLive.pipe(
    Layer.provide(
      Layer.succeed(VoidConfig)({
        apiUrl: 'http://void',
        token: Redacted.make('t'),
        checksum: 'c',
      }),
    ),
    Layer.provide(Layer.succeed(HttpClient.HttpClient)(fakeServer(handle))),
  )

const posted: Array<[string, string, unknown]> = []
const plan = apiWith((method, path, body) => {
  posted.push([method, path, body])
  return {
    version_id: 'a'.repeat(64),
    id: null,
    checksum: 'c',
    applied: false,
    has_configuration: false,
    status: null,
    created_at: 't',
    entries: [
      {
        reason: null,
        id: null,
        price_preview: null,
        kind: 'reducer',
        key: 'calls',
        action: 'create',
      },
      {
        reason: null,
        price_preview: null,
        kind: 'reducer',
        key: 'tokens',
        action: 'unchanged',
        id: 'r1',
      },
      {
        kind: 'meter',
        key: 'tokens',
        action: 'update',
        reason: 'price changed',
        id: 'm1',
        price_preview: {
          unavailable: null,
          excluded_customers: [],
          window: { start: '2026-01-01', end: '2026-02-01' },
          currency: 'usd',
          current_unit_amount: '0.002',
          proposed_unit_amount: '0.003',
          billable_units: '10000',
          current_amount: '20',
          proposed_amount: '30',
          difference: '10',
          customers: [
            {
              external_id: 'acme',
              name: 'Acme',
              billable_units: '10000',
              current_amount: '20',
              proposed_amount: '30',
              difference: '10',
            },
          ],
        },
      },
      {
        reason: null,
        price_preview: null,
        kind: 'meter',
        key: 'legacy',
        action: 'orphan',
        id: 'm9',
      },
    ],
  }
})

const DeployBody = Schema.Struct({
  checksum: Schema.String,
  dry_run: Schema.Boolean,
  reducers: Schema.Array(Schema.Unknown),
  meters: Schema.Array(
    Schema.Struct({ slug: Schema.String, reducer: Schema.String }),
  ),
})

layer(
  apiWith((method, path, raw) => {
    assert.equal(method, 'POST')
    assert.equal(path, '/v1/void/deploys')
    const body = Schema.decodeUnknownSync(DeployBody)(raw)
    assert.equal(body.dry_run, false)
    assert.equal(body.checksum, checksum(ir))
    return {
      version_id: 'a'.repeat(64),
      id: 'deployment-1',
      checksum: body.checksum,
      applied: true,
      has_configuration: true,
      status: 'draft',
      created_at: 't',
      entries: [
        {
          reason: null,
          price_preview: null,
          kind: 'meter',
          key: 'tokens',
          action: 'create',
          id: 'm1',
        },
      ],
    }
  }),
)((it) => {
  it.effect(
    'deploy applies the config and reports success without filesystem access',
    () =>
      Effect.gen(function* () {
        yield* reconcile('deploy', config)
        const lines = (yield* TestConsole.logLines).join('\n')
        assert.match(lines, /applied 1 as deployment deployment-1/)
      }),
  )
})

layer(
  apiWith((method, path) => {
    assert.equal(method, 'POST')
    assert.equal(path, '/v1/void/deploys/deployment-2/activate')
    return {
      version_id: 'b'.repeat(64),
      id: 'deployment-2',
      checksum: 'c',
      applied: true,
      has_configuration: true,
      status: 'active',
      created_at: 't',
      entries: [],
    }
  }),
)((it) => {
  it.effect('activate makes a deployment active by id', () =>
    Effect.gen(function* () {
      yield* activateDeployment('deployment-2')
      const lines = (yield* TestConsole.logLines).join('\n')
      assert.match(lines, /status active/)
      assert.match(lines, /activated deployment deployment-2/)
    }),
  )
})

layer(NodeServices.layer)((it) => {
  it.layer(plan)('plan', (it) => {
    it.effect(
      'posts the compiled config as a dry run and prints the server plan',
      () =>
        Effect.gen(function* () {
          yield* reconcile('plan', config)
          assert.equal(posted.length, 1)
          const [method, path, raw] = posted[0] ?? ['', '', undefined]
          const body = yield* Schema.decodeUnknownEffect(DeployBody)(raw)
          assert.equal(method, 'POST')
          assert.equal(path, '/v1/void/deploys')
          assert.equal(body.dry_run, true)
          assert.equal(body.checksum, checksum(ir))
          assert.equal(body.reducers.length, 2)
          assert.deepEqual(
            body.meters.map((m) => [m.slug, m.reducer]),
            [['tokens', 'tokens']],
          )
          const lines = (yield* TestConsole.logLines).join('\n')
          assert.match(lines, /\+ {2}reducer\s+calls\s+create/)
          assert.match(lines, /~ {2}meter\s+tokens\s+update\s+price changed/)
          assert.match(lines, /\? {2}meter\s+legacy\s+orphan/)
          assert.notMatch(lines, /= {2}reducer/)
          assert.match(lines, /2 to apply, 1 unchanged, 1 orphaned/)
          assert.match(lines, /Acme\s+10,000\s+\$20.00\s+\$30.00\s+\+\$10.00/)
        }),
    )
  })

  it.effect('loadConfig takes the config or default export', () =>
    Effect.gen(function* () {
      const loaded = yield* loadConfig(Option.some('x.ts'), async () => ({
        default: config,
      }))
      assert.equal(loaded, config)
    }),
  )

  it.effect('loadConfig rejects a module without a config', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        loadConfig(Option.some('x.ts'), async () => ({ nope: 1 })),
      )
      assert.equal(error._tag, 'ConfigError')
      assert.match(error.message, /exports no config/)
    }),
  )
})

it('plan and deploy use supplied credentials with the same organization-free config', async () => {
  const requests: Request[] = []
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname === '/v1/void/organizations/current') {
        return Response.json({
          active_version_id: 'a'.repeat(64),
          active_deployment_id: 'deployment',
          can_activate: true,
          id: 'org1',
          name: 'Test',
          slug: 'test',
          created_at: '2026-09-06T00:00:00Z',
        })
      }
      requests.push(request)
      return Response.json(
        {
          version_id: 'a'.repeat(64),
          id: null,
          checksum: checksum(ir),
          applied: false,
          has_configuration: false,
          status: null,
          created_at: '2026-09-06T00:00:00Z',
          entries: [],
        },
        { status: 201 },
      )
    })
  try {
    for (const command of ['plan', 'deploy']) {
      await run(
        [
          command,
          '--config',
          'void.ts',
          '--api-url',
          'http://void',
          '--token',
          `${command}-organization-token`,
          ...(command === 'plan'
            ? ['--from', '2026-01-01', '--to', '2026-02-01']
            : []),
        ],
        async () => ({ config }),
      )
    }
    assert.equal(requests.length, 2)
    for (const [index, command] of ['plan', 'deploy'].entries()) {
      const request = requests[index]!
      assert.equal(
        request.headers.get('authorization'),
        `Bearer ${command}-organization-token`,
      )
      assert.equal(request.url, 'http://void/v1/void/deploys')
      assert.deepEqual(await request.json(), {
        checksum: checksum(ir),
        dry_run: command === 'plan',
        activate: false,
        reducers: ir.reducers,
        meters: ir.meters,
        entitlements: ir.entitlements,
        products: ir.products,
        ...(command === 'plan'
          ? { preview: { start: '2026-01-01', end: '2026-02-01' } }
          : {}),
      })
    }
  } finally {
    fetch.mockRestore()
  }
})

it.each([{ flags: [] }, { flags: ['--no-preview'] }])(
  'plan $flags sends configuration changes without a preview',
  async ({ flags: previewFlags }) => {
    const bodies: unknown[] = []
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        if (new URL(request.url).pathname === '/v1/void/organizations/current')
          return Response.json({
            active_version_id: 'a'.repeat(64),
            active_deployment_id: 'deployment',
            can_activate: true,
            id: 'org1',
            name: 'Test',
            slug: 'test',
            created_at: '2026-01-01T00:00:00Z',
          })
        bodies.push(await request.json())
        return Response.json({
          version_id: 'a'.repeat(64),
          id: null,
          checksum: 'c',
          applied: false,
          has_configuration: false,
          status: null,
          created_at: 't',
          entries: [],
        })
      })
    try {
      await run(
        [
          'plan',
          ...previewFlags,
          '--config',
          'void.ts',
          '--api-url',
          'http://void',
          '--token',
          'test',
        ],
        async () => ({ config }),
      )
      assert.equal(bodies.length, 1)
      assert.notProperty(bodies[0], 'preview')
    } finally {
      fetch.mockRestore()
    }
  },
)

it.each([
  { flags: ['--preview'] },
  { flags: ['--from', '2026-01-01', '--to', '2026-02-01'] },
])(
  'rejects --no-preview with $flags before loading config or making requests',
  async ({ flags: previewFlags }) => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const load = vi.fn(async () => ({ config }))
    try {
      await expect(
        run(['plan', '--no-preview', ...previewFlags], load),
      ).rejects.toThrow('--no-preview cannot be combined')
      assert.equal(load.mock.calls.length, 0)
      assert.equal(fetch.mock.calls.length, 0)
    } finally {
      fetch.mockRestore()
    }
  },
)

layer(
  apiWith((method, path, body) => {
    assert.equal(method, 'POST')
    assert.equal(path, '/v1/void/deploys')
    assert.notProperty(body, 'version_id')
    assert.notProperty(body, 'signals')
    expect(body).toMatchObject({
      products: [
        {
          slug: 'pro',
          meters: [{ slug: 'tokens', included: 0, limit: 'soft' }],
        },
      ],
    })
    return {
      id: null,
      checksum: 'c',
      version_id: 'f'.repeat(64),
      applied: true,
      has_configuration: true,
      status: 'draft',
      created_at: 't',
      entries: [],
    }
  }),
)((it) => {
  it.effect(
    'publishes definitions without a version name and reports the returned config hash',
    () =>
      Effect.gen(function* () {
        yield* reconcile(
          'deploy',
          defineConfig({
            versionId: 'lookup-only',
            schema: {
              budgetLow: signal('budget-low', {
                meter: config.meters[0]!,
                field: 'remaining',
                enter: { below: 100 },
                exit: { atLeast: 150 },
              }),
              pro: product('pro', {
                name: 'Pro',
                price: recurring({ interval: 'month', amount: usd(49) }),
                meters: [config.meters[0]!],
              }),
            },
          }),
        )
        assert.match((yield* TestConsole.logLines).join('\n'), /version f{64}/)
      }),
  )
})

layer(
  apiWith((_method, _path, body) => {
    expect(body).toMatchObject({
      products: [
        {
          slug: 'pro',
          meters: [{ slug: 'tokens', included: 100, limit: 'hard' }],
        },
      ],
    })
    return {
      id: null,
      checksum: 'c',
      version_id: 'f'.repeat(64),
      applied: true,
      has_configuration: true,
      status: 'draft',
      created_at: 't',
      entries: [],
    }
  }),
)((it) => {
  it.effect('sends included amounts and limits as the config states them', () =>
    Effect.gen(function* () {
      yield* reconcile(
        'deploy',
        defineConfig({
          schema: {
            pro: product('pro', {
              name: 'Pro',
              price: recurring({ interval: 'month', amount: usd(49) }),
              meters: [included(config.meters[0]!, 100, { limit: 'hard' })],
            }),
          },
        }),
      )
      assert.match((yield* TestConsole.logLines).join('\n'), /version f{64}/)
    }),
  )
})

it('deploy sends complete product, entitlement and meter terms', async () => {
  const compiled = compile(deploymentConfig)
  const bodies: unknown[] = []
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname === '/v1/void/organizations/current')
        return Response.json({
          id: 'org1',
          name: 'Test',
          slug: 'test',
          created_at: '2026-09-06T00:00:00Z',
          active_version_id: 'a'.repeat(64),
          active_deployment_id: 'deployment',
          can_activate: true,
        })
      bodies.push(await request.json())
      return Response.json(
        {
          id: 'deployment-1',
          checksum: checksum(compiled),
          version_id: 'f'.repeat(64),
          applied: true,
          has_configuration: true,
          status: 'draft',
          created_at: '2026-09-06T00:00:00Z',
          entries: [],
        },
        { status: 201 },
      )
    })
  try {
    await run(
      [
        'deploy',
        '--config',
        'void.ts',
        '--api-url',
        'http://void',
        '--token',
        'test',
      ],
      async () => ({ config: deploymentConfig }),
    )
    assert.deepEqual(bodies, [
      {
        checksum: checksum(compiled),
        activate: false,
        dry_run: false,
        reducers: compiled.reducers,
        meters: compiled.meters,
        entitlements: compiled.entitlements,
        products: compiled.products,
      },
    ])
    assert.deepEqual(compiled.products[0]?.meters, [
      {
        slug: 'deployment-tokens',
        included: 1000,
        limit: 'hard',
        rollover_cap: 500,
      },
    ])
    assert.deepEqual(compiled.products[0]?.entitlements, ['deployment-support'])
  } finally {
    fetch.mockRestore()
  }
})

it.each([
  { flags: ['--preview'] },
  { flags: ['--from', '2026-01-01', '--to', '2026-02-01'] },
])(
  'plan $flags propagates unavailable previews without retrying or dropping them',
  async ({ flags: previewFlags }) => {
    const bodies: unknown[] = []
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        if (new URL(request.url).pathname === '/v1/void/organizations/current')
          return Response.json({
            id: 'org1',
            name: 'Test',
            slug: 'test',
            created_at: '2026-09-06T00:00:00Z',
            active_version_id: 'a'.repeat(64),
            active_deployment_id: 'deployment',
            can_activate: true,
          })
        bodies.push(await request.json())
        return Response.json(
          {
            error: 'PricePreviewUnavailable',
            detail: 'Price previews are not available yet; use --no-preview.',
          },
          { status: 501 },
        )
      })
    try {
      await expect(
        run(
          [
            'plan',
            '--config',
            'void.ts',
            '--api-url',
            'http://void',
            '--token',
            'test',
            ...previewFlags,
          ],
          async () => ({ config: deploymentConfig }),
        ),
      ).rejects.toThrow('use --no-preview')
      assert.equal(bodies.length, 1)
      expect(bodies[0]).toMatchObject({
        dry_run: true,
        preview: {
          start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      })
    } finally {
      fetch.mockRestore()
    }
  },
)

describe('pull', () => {
  const deploymentIr = compile(deploymentConfig)
  const stored = JSON.parse(
    JSON.stringify({
      reducers: deploymentIr.reducers.map((r) => ({ ...r, map: null })),
      meters: deploymentIr.meters.map((m) => ({
        ...m,
        unit_amount: String(m.unit_amount),
        credit_reducer: null,
      })),
      entitlements: deploymentIr.entitlements,
      products: deploymentIr.products.map((p) => ({
        ...p,
        description: null,
        price: { ...p.price, amount: String(p.price.amount) },
      })),
    }),
  )
  const deploy = (
    id: string,
    status: string,
    created_at: string,
    has_configuration = true,
  ) => ({
    version_id: id.repeat(64),
    id: `d-${id}`,
    checksum: 'c',
    applied: true,
    status,
    has_configuration,
    created_at,
    entries: [],
  })
  // v1 archived, v2 active, v3 a draft without a stored configuration, v4 a draft.
  const deploys = [
    deploy('a', 'archived', '2026-01-01T00:00:00Z'),
    deploy('b', 'active', '2026-02-01T00:00:00Z'),
    deploy('c', 'draft', '2026-03-01T00:00:00Z', false),
    deploy('d', 'draft', '2026-04-01T00:00:00Z'),
  ]
  const scenario = {
    id: 's1',
    name: 'Cheaper Pro',
    base_version_id: 'b'.repeat(64),
    base_deployment_id: 'd-b',
    patch: { products: {}, meters: {} },
    version_id: 'e'.repeat(64),
    deployment_id: null,
    promoted_deployment_id: null,
    base_configuration: { checksum: 'c', ...stored },
    configuration: {
      checksum: 'c',
      ...stored,
      meters: stored.meters.map((m: { unit_amount: string }) => ({
        ...m,
        unit_amount: '0.004',
      })),
    },
    created_at: '2026-05-01T00:00:00Z',
    modified_at: null,
  }
  const serve = () => {
    const requests: Request[] = []
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path === '/v1/void/organizations/current')
          return Response.json({
            active_version_id: 'b'.repeat(64),
            active_deployment_id: 'd-b',
            can_activate: true,
            id: 'org1',
            name: 'Test',
            slug: 'test',
            created_at: '2026-01-01T00:00:00Z',
          })
        if (path === '/v1/void/deploys' && request.method === 'GET')
          return Response.json(deploys)
        if (path === '/v1/void/scenarios') return Response.json([scenario])
        const configuration = path.match(
          /^\/v1\/void\/deploys\/(d-.)\/configuration$/,
        )
        if (configuration) return Response.json(stored)
        return Response.json(
          {
            ...deploy('b', 'active', 't'),
            id: null,
            applied: false,
            has_configuration: false,
            status: null,
          },
          { status: 201 },
        )
      })
    return { requests, fetch }
  }
  const auth = ['--api-url', 'http://void', '--token', 'test']
  const noLoad = async () => ({})

  const withDir = async (
    body: (dir: string, log: ReturnType<typeof vi.spyOn>) => Promise<void>,
  ) => {
    const dir = await mkdtemp(join(tmpdir(), 'void-pull-'))
    const { fetch } = serve()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await body(dir, log)
    } finally {
      fetch.mockRestore()
      log.mockRestore()
      await rm(dir, { recursive: true, force: true })
    }
  }
  const logged = (log: ReturnType<typeof vi.spyOn>) =>
    log.mock.calls.flat().join('\n')

  it('writes the active deployment as void.json, which plans as it is', () =>
    withDir(async (dir, log) => {
      const out = join(dir, 'void.json')
      await run(['pull', '--out', out, ...auth], noLoad)
      assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), deploymentIr)
      assert.match(logged(log), /source v2 b{64} \(active\)/)
      await expect(
        run(['pull', '--out', out, ...auth], noLoad),
      ).rejects.toThrow('already exists')
      await run(['pull', '--out', out, '--force', ...auth], noLoad)

      const { requests, fetch } = serve()
      try {
        await run(['plan', '--no-preview', '--config', out, ...auth], noLoad)
        const posted = requests.find((r) => r.method === 'POST')!
        assert.deepEqual(await posted.json(), {
          checksum: checksum(deploymentIr),
          dry_run: true,
          activate: false,
          reducers: deploymentIr.reducers,
          meters: deploymentIr.meters,
          entitlements: deploymentIr.entitlements,
          products: deploymentIr.products,
        })
      } finally {
        fetch.mockRestore()
      }
    }))

  it('pulls drafts, labelled versions and scenarios into files named after them', () =>
    withDir(async (dir, log) => {
      const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir)
      try {
        await run(['pull', '--draft', ...auth], noLoad)
        assert.match(logged(log), /source v4 d{64} \(draft\)/)
        assert.deepEqual(
          JSON.parse(await readFile(join(dir, 'void.v4.json'), 'utf8')),
          deploymentIr,
        )
        await run(['pull', '--version', 'v1', ...auth], noLoad)
        assert.match(logged(log), /source v1 a{64} \(archived\)/)
        await run(['pull', '--scenario', 'cheaper pro', ...auth], noLoad)
        const pulled = JSON.parse(
          await readFile(join(dir, 'void.cheaper-pro.json'), 'utf8'),
        )
        assert.equal(pulled.meters[0].unit_amount, 0.004)
        assert.match(logged(log), /source scenario Cheaper Pro on v2 b{64}/)
        await expect(
          run(['pull', '--version', 'v3', ...auth], noLoad),
        ).rejects.toThrow('no pullable deployment for version v3')
        await expect(
          run(['pull', '--scenario', 'nope', ...auth], noLoad),
        ).rejects.toThrow('no scenario named nope')
        await expect(run(['pull', '-i', ...auth], noLoad)).rejects.toThrow(
          'no terminal',
        )
      } finally {
        cwd.mockRestore()
      }
    }))

  it('writes TypeScript with --ts and confirms it compiles back to the same version', () =>
    withDir(async (dir, log) => {
      const out = join(dir, 'void.ts')
      // The generated file imports the published package; point it at the sources.
      const load = async (url: string) => {
        const file = fileURLToPath(url)
        const resolved = file.replace(/\.ts$/, '.resolved.ts')
        await writeFile(
          resolved,
          (await readFile(file, 'utf8')).replace(
            "'@void/sdk/config'",
            JSON.stringify(join(import.meta.dirname, '../src/config/index')),
          ),
        )
        return import(pathToFileURL(resolved).href) as Promise<
          Record<string, unknown>
        >
      }
      await run(['pull', '--ts', '--out', out, ...auth], load)
      const source = await readFile(out, 'utf8')
      assert.match(
        source,
        /^\/\/ Pulled from Polar Void: v2 b{64} \(active\)\./,
      )
      assert.match(source, /export const config = defineConfig/)
      assert.notMatch(logged(log), /warning/)
    }))
})

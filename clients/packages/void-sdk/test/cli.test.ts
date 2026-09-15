import { vi } from 'vitest'
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
import { loadConfig, reconcile, run } from '../src/cli/index'

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
    checksum: 'c',
    applied: false,
    created_at: 't',
    entries: [
      { kind: 'reducer', key: 'calls', action: 'create' },
      { kind: 'reducer', key: 'tokens', action: 'unchanged', id: 'r1' },
      {
        kind: 'meter',
        key: 'tokens',
        action: 'update',
        reason: 'price changed',
        id: 'm1',
        price_preview: {
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
      { kind: 'meter', key: 'legacy', action: 'orphan', id: 'm9' },
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
    assert.equal(path, '/v1/deploys')
    const body = Schema.decodeUnknownSync(DeployBody)(raw)
    assert.equal(body.dry_run, false)
    assert.equal(body.checksum, checksum(ir))
    return {
      id: 'deployment-1',
      checksum: body.checksum,
      applied: true,
      created_at: 't',
      entries: [{ kind: 'meter', key: 'tokens', action: 'create', id: 'm1' }],
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
          assert.equal(path, '/v1/deploys')
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
      if (new URL(request.url).pathname === '/v1/organizations/current') {
        return Response.json({
          id: 'org1',
          name: 'Test',
          slug: 'test',
          created_at: '2026-09-06T00:00:00Z',
        })
      }
      requests.push(request)
      return Response.json(
        {
          checksum: checksum(ir),
          applied: false,
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
      assert.equal(request.url, 'http://void/v1/deploys')
      assert.deepEqual(await request.json(), {
        checksum: checksum(ir),
        dry_run: command === 'plan',
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

it('plan --no-preview sends the existing dry-run payload', async () => {
  const bodies: unknown[] = []
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      if (new URL(request.url).pathname === '/v1/organizations/current')
        return Response.json({
          id: 'org1',
          name: 'Test',
          slug: 'test',
          created_at: '2026-01-01T00:00:00Z',
        })
      bodies.push(await request.json())
      return Response.json({
        checksum: 'c',
        applied: false,
        created_at: 't',
        entries: [],
      })
    })
  try {
    await run(
      [
        'plan',
        '--no-preview',
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
})

it('rejects conflicting preview flags before loading config or making requests', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const load = vi.fn(async () => ({ config }))
  try {
    await expect(
      run(
        ['plan', '--no-preview', '--from', '2026-01-01', '--to', '2026-02-01'],
        load,
      ),
    ).rejects.toThrow('--no-preview cannot be combined')
    assert.equal(load.mock.calls.length, 0)
    assert.equal(fetch.mock.calls.length, 0)
  } finally {
    fetch.mockRestore()
  }
})

layer(
  apiWith((method, path, body) => {
    assert.equal(method, 'POST')
    assert.equal(path, '/v1/deploys')
    assert.notProperty(body, 'variant_id')
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
      checksum: 'c',
      variant_id: 'f'.repeat(64),
      applied: true,
      created_at: 't',
      entries: [],
    }
  }),
)((it) => {
  it.effect(
    'publishes definitions without a variant name and reports the returned config hash',
    () =>
      Effect.gen(function* () {
        yield* reconcile(
          'deploy',
          defineConfig({
            variantId: 'lookup-only',
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
        assert.match((yield* TestConsole.logLines).join('\n'), /variant f{64}/)
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
      checksum: 'c',
      variant_id: 'f'.repeat(64),
      applied: true,
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
      assert.match((yield* TestConsole.logLines).join('\n'), /variant f{64}/)
    }),
  )
})

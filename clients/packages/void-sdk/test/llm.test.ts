import { assert, expect, expectTypeOf, it, vi } from '@effect/vitest'
import { gateway as aiGateway, generateText, streamText } from 'ai'
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test'
import type { Schema } from 'effect'
import {
  VoidError,
  compile,
  createVoid,
  defineConfig,
  included,
  product,
  recurring,
  usd,
} from '../src/index'
import {
  llm,
  canonicalModel,
  costPlus,
  fallback,
  tags,
  inCredits,
  openrouter,
  perCall,
  perThousandOutput,
  perToken,
  percent,
  vercelGateway,
  type Skipped,
} from '../src/plugins/index'

type Json = Schema.Json

const prices = {
  'anthropic/claude-opus-5': { input: usd(0.000015), output: usd(0.000075) },
  'anthropic/claude-sonnet-5': {
    input: usd(0.000003),
    output: usd(0.000015),
  },
  'openai/gpt-5': { input: usd(0.000002), output: usd(0.000008) },
  other: { input: usd(0.000004), output: usd(0.00002) },
}
const ai = llm({
  gateway: vercelGateway(),
  models: [
    'anthropic/claude-opus-5',
    'anthropic/claude-sonnet-5',
    'openai/gpt-5',
  ],
  billing: perToken(prices, { markup: percent(50) }),
  tags: tags<{ feature: string }>(),
})
const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [
    included(ai.models['anthropic/claude-sonnet-5'].input, 1_000_000),
    ai.models['anthropic/claude-sonnet-5'].output,
    ai.other.input,
    ai.other.output,
    ai.cost,
  ],
})
const config = defineConfig({ schema: { ai, pro } })
const ir = compile(config)

it('llm.meters lists every meter the plugin defines, for spreading onto a product', () => {
  assert.deepEqual(ai.meters.map((m) => m.key).sort(), [
    'llm-cost',
    'llm-input-anthropic-claude-opus-5',
    'llm-input-anthropic-claude-sonnet-5',
    'llm-input-openai-gpt-5',
    'llm-input-other',
    'llm-output-anthropic-claude-opus-5',
    'llm-output-anthropic-claude-sonnet-5',
    'llm-output-openai-gpt-5',
    'llm-output-other',
  ])
  const spread = product('spread', {
    name: 'Spread',
    price: recurring({ interval: 'month', amount: usd(49) }),
    meters: [
      included(ai.models['anthropic/claude-sonnet-5'].input, 1_000_000),
      ...ai.meters,
    ],
  })
  assert.equal(spread.meters.length, ai.meters.length)
  assert.equal(
    spread.meters.find(
      (m) => m.meter.key === 'llm-input-anthropic-claude-sonnet-5',
    )!.included,
    1_000_000,
  )
})

it('per token compiles to marked-up token meters plus a cost-of-goods meter', () => {
  assert.deepEqual(
    ir.events.map((e) => e.name),
    ['llm.completion'],
  )
  const unit = Object.fromEntries(ir.meters.map((m) => [m.slug, m.unit_amount]))
  assert.equal(unit['llm-input-anthropic-claude-sonnet-5'], 0.0000045)
  assert.equal(unit['llm-output-openai-gpt-5'], 0.000012)
  assert.equal(unit['llm-input-other'], 0.000006)
  assert.equal(unit['llm-cost'], 0)
  assert.ok(!('llm-spend' in unit) && !('llm-credits' in unit))
  const cost = ir.reducers.find((r) => r.slug === 'llm-cost')
  assert.deepEqual(cost?.aggregation, { func: 'sum', property: 'cost' })
  assert.deepEqual(cost?.filter?.clauses, [
    { property: 'name', operator: 'eq', value: 'llm.completion' },
  ])
})

const serve = (remaining: Record<string, number>) => {
  const posts: Array<Record<string, Json>> = []
  const checks: string[] = []
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status })
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(
      input instanceof Request ? input.url : input,
    )
    const path = pathname.replace(/^\/v1\/void(?=\/|$)/, '')
    const raw = init?.body
    const text =
      typeof raw === 'string'
        ? raw
        : raw instanceof Uint8Array
          ? new TextDecoder().decode(raw)
          : undefined
    const body: Json | undefined = text ? JSON.parse(text) : undefined
    if (path === '/reducers')
      return json(
        ir.reducers.map((r) => ({
          id: `r-${r.slug}`,
          slug: r.slug,
          created_at: 'a',
          type: 'scalar',
          filter: r.filter,
          aggregation: r.aggregation,
        })),
      )
    if (path === '/meters')
      return json(
        ir.meters.map((m) => ({
          id: `m-${m.slug}`,
          name: m.slug,
          slug: m.slug,
          generation_id: 1,
          branch_id: null,
          usage_reducer_id: `r-${m.slug}`,
          credit_reducer_id: `r-${m.slug}-credits`,
          unit_amount: String(m.unit_amount),
          currency: 'usd',
          created_at: 'a',
        })),
      )
    const check = path.match(/^\/meters\/m-(.+)\/check$/)
    if (check) {
      const slug = check[1]!
      checks.push(slug)
      const left = remaining[slug] ?? 0
      const allowed = left >= Number(searchParams.get('size'))
      return json({
        allowed,
        reason: allowed ? 'ok' : 'exhausted',
        remaining: left,
        overage: 0,
        limit: 'hard',
        external_identity_id: 'org_1',
      })
    }
    if (path === '/events' && init?.method === 'POST') {
      const rows = Array.isArray(body) ? body : []
      for (const row of rows)
        if (typeof row === 'object' && row !== null && !Array.isArray(row))
          posts.push(row)
      return json({ saved: rows.length, ignored: 0 }, 202)
    }
    if (path === '/organizations/current')
      return json({
        id: 'org',
        name: 'Org',
        slug: 'org',
        created_at: 'a',
        default_variant_id: null,
      })
    return json({ error: 'ResourceNotFound', detail: path }, 404)
  }
  return { fetch, posts, checks }
}

const isObject = (v: Json | undefined): v is { readonly [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const metadata = (post: Record<string, Json> | undefined) => {
  const m = post?.metadata
  return isObject(m) ? m : {}
}

const generous = {
  'llm-input-anthropic-claude-opus-5': 1_000_000,
  'llm-output-anthropic-claude-opus-5': 1_000_000,
  'llm-input-anthropic-claude-sonnet-5': 1_000_000,
  'llm-output-anthropic-claude-sonnet-5': 1_000_000,
  'llm-input-other': 1_000_000,
  'llm-output-other': 1_000_000,
}

const usage = {
  inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 0 },
  outputTokens: { total: 40, text: 30, reasoning: 10 },
}
const gateway = { gateway: { generationId: 'gen_01', cost: '0.0021' } }

const mock = (modelId = 'anthropic/claude-sonnet-5') =>
  new MockLanguageModelV4({
    provider: 'gateway',
    modelId,
    doGenerate: {
      content: [{ type: 'text', text: `hello from ${modelId}` }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      providerMetadata: gateway,
      response: { id: 'resp_1', modelId, timestamp: new Date(0) },
      warnings: [],
    },
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp_2' },
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'hel' },
        { type: 'text-delta', id: '1', delta: 'lo' },
        { type: 'text-end', id: '1' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          providerMetadata: gateway,
        },
      ]),
    },
  })

const client = (server: ReturnType<typeof serve>) =>
  createVoid(config, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })

it('a wrapped model gates on the meter pair, tags the gateway request, and records the completion', async () => {
  const server = serve(generous)
  const void_ = client(server)
  const org = void_.as('org_1')
  const sonnet = mock()
  const seen: string[] = []

  const model = org.ai.model(sonnet, {
    tags: { feature: 'chat' },
    allow: ({ model, estimate }) => {
      seen.push(`allow:${model}:${estimate.maxOutputTokens}`)
    },
    onEnd: ({ completion }) => {
      seen.push(`end:${completion.output_tokens}`)
    },
  })
  const { text } = await generateText({
    model,
    prompt: 'Say hello',
    maxOutputTokens: 500,
    providerOptions: { gateway: { tags: ['env:test'], order: ['anthropic'] } },
  })
  assert.equal(text, 'hello from anthropic/claude-sonnet-5')
  assert.deepEqual(seen, ['allow:anthropic/claude-sonnet-5:500', 'end:40'])
  assert.deepEqual(server.checks.sort(), [
    'llm-input-anthropic-claude-sonnet-5',
    'llm-output-anthropic-claude-sonnet-5',
  ])

  // The caller's gateway options survive; ours are merged in.
  const call = sonnet.doGenerateCalls[0]!
  assert.deepEqual(call.providerOptions, {
    gateway: {
      order: ['anthropic'],
      user: 'org_1',
      tags: ['env:test', 'feature:chat'],
    },
  })

  assert.equal(server.posts.length, 1)
  const post = server.posts[0]!
  assert.equal(post.name, 'llm.completion')
  assert.equal(post.external_identity_id, 'org_1')
  const m = metadata(post)
  assert.equal(m.model, 'anthropic/claude-sonnet-5')
  assert.equal(m.provider, 'gateway')
  assert.equal(m.input_tokens, 120)
  assert.equal(m.output_tokens, 40)
  assert.equal(m.cache_read_tokens, 20)
  assert.equal(m.reasoning_tokens, 10)
  assert.equal(m.cost, 0.0021)
  assert.equal(m.generation_id, 'gen_01')
  assert.equal(m.response_id, 'resp_1')
  assert.equal(m.call_id, null)
  assert.equal(m.fallback_from, null)
  assert.equal(m.finish_reason, 'stop')
  assert.equal(m.feature, 'chat')
  assert.equal(typeof m.latency_ms, 'number')
  assert.ok(!('cached_input_tokens' in m))

  // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
  if (false) {
    // @ts-expect-error declared tags are required
    org.ai.model(sonnet)
    // @ts-expect-error declared tags are required
    org.ai.model(sonnet, { gate: 'off' })
    // @ts-expect-error declared tags are required
    org.ai.telemetry()
    // @ts-expect-error declared tags are required
    ai.telemetry(void_)
    // Without declared tags every options argument is optional.
    const bare = llm({
      gateway: vercelGateway(),
      models: [],
      billing: perToken({ other: prices.other }),
    })
    llm({
      gateway: vercelGateway(),
      models: [],
      billing: perToken({ other: prices.other }),
      tags: tags<{ feature: string }>(),
      capture: false,
    })
    // The billing table must cover every named model.
    llm({
      gateway: vercelGateway(),
      models: ['a', 'b'],
      // @ts-expect-error b has no price
      billing: perToken({ a: prices.other, other: prices.other }),
    })
    const scope = createVoid(defineConfig({ schema: { bare } }), {
      apiUrl: '',
      token: '',
    }).as('x')
    scope.bare.model(sonnet)
    scope.bare.telemetry()
    bare.telemetry(void_)
    expectTypeOf(scope.bare.model).parameters.toMatchTypeOf<
      [model: unknown, options?: unknown]
    >()
    // Per token exposes meters; the other modes expose plain totals.
    expectTypeOf(org.ai.models['openai/gpt-5'].input.check).toBeFunction()
    expectTypeOf(ai.models['openai/gpt-5'].input.price).toBeObject()
  }
  await void_.dispose()
})

it('a caller-set gateway user wins over the identity', async () => {
  const server = serve(generous)
  const void_ = client(server)
  const sonnet = mock()
  const model = void_.as('org_1').ai.model(sonnet, {
    tags: { feature: 'chat' },
    gate: 'off',
  })
  await generateText({
    model,
    prompt: 'hi',
    providerOptions: { gateway: { user: 'their-user' } },
  })
  assert.equal(
    sonnet.doGenerateCalls[0]?.providerOptions?.gateway?.user,
    'their-user',
  )
  await void_.dispose()
})

it('the gate blocks by default, can warn instead, and an allow veto always blocks', async () => {
  const server = serve({
    ...generous,
    'llm-output-anthropic-claude-sonnet-5': 10,
  })
  const void_ = client(server)
  const org = void_.as('org_1')
  const denied: string[] = []
  const dims = { feature: 'chat' }

  const blocking = org.ai.model(mock(), {
    tags: dims,
    onDenied: ({ by, check }) => {
      denied.push(`${by}:${check?.reason}:${check?.unit}`)
    },
  })
  await expect(
    generateText({ model: blocking, prompt: 'hi', maxOutputTokens: 50 }),
  ).rejects.toSatisfy(
    (error: unknown) => error instanceof VoidError && error.reason === 'denied',
  )
  assert.deepEqual(denied, ['gate:cap:tokens'])
  assert.equal(server.posts.length, 0)

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const warning = org.ai.model(mock(), { tags: dims, gate: 'warn' })
  await generateText({ model: warning, prompt: 'hi', maxOutputTokens: 50 })
  assert.equal(server.posts.length, 1)
  assert.match(warn.mock.calls[0]?.[0], /denied by gate/)
  warn.mockRestore()

  const vetoed = org.ai.model(mock(), {
    tags: dims,
    gate: 'warn',
    allow: () => false,
  })
  await expect(generateText({ model: vetoed, prompt: 'hi' })).rejects.toSatisfy(
    (error: unknown) =>
      error instanceof VoidError && error.message.includes('denied by allow'),
  )
  assert.equal(server.posts.length, 1)
  await void_.dispose()
})

it('a streamed call records from the finish part with the response id', async () => {
  const server = serve(generous)
  const void_ = client(server)
  const model = void_
    .as('org_1')
    .ai.model(mock(), { tags: { feature: 'chat' }, gate: 'off' })

  const result = streamText({ model, prompt: 'hi' })
  let text = ''
  for await (const delta of result.textStream) text += delta
  assert.equal(text, 'hello')
  assert.equal(server.posts.length, 1)
  const m = metadata(server.posts[0])
  assert.equal(m.output_tokens, 40)
  assert.equal(m.generation_id, 'gen_01')
  assert.equal(m.response_id, 'resp_2')
  await void_.dispose()
})

/** Resolves model ids to mocks the way the AI SDK's default provider would. */
const withDefaultProvider = async (
  models: Record<string, MockLanguageModelV4>,
  run: () => Promise<void>,
) => {
  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    specificationVersion: 'v4',
    languageModel: (id: string) => {
      const found = models[id]
      if (!found) throw new Error(`no mock for ${id}`)
      return found
    },
    embeddingModel: () => {
      throw new Error('unused')
    },
    imageModel: () => {
      throw new Error('unused')
    },
  } as never
  try {
    await run()
  } finally {
    globalThis.AI_SDK_DEFAULT_PROVIDER = undefined
  }
}

it('a model id is resolved like the AI SDK resolves it', async () => {
  const server = serve(generous)
  const void_ = client(server)
  const gpt = mock('openai/gpt-5')
  await withDefaultProvider({ 'openai/gpt-5': gpt }, async () => {
    const model = void_.as('org_1').ai.model('openai/gpt-5', {
      tags: { feature: 'chat' },
      gate: 'off',
    })
    await generateText({ model, prompt: 'hi' })
    assert.equal(gpt.doGenerateCalls.length, 1)
    assert.equal(metadata(server.posts[0]).model, 'openai/gpt-5')
  })
  await void_.dispose()
})

it('a ladder runs the first model with room and records the fallback', async () => {
  const tiers = [
    'anthropic/claude-opus-5',
    'anthropic/claude-sonnet-5',
    'openai/gpt-5',
  ] as const
  type Ai = ReturnType<ReturnType<typeof client>['as']>['ai']
  /** Every tier wrapped with the same options; the last one may differ. */
  const ladder = (
    ai: Ai,
    options: Parameters<Ai['model']>[1],
    last: Parameters<Ai['model']>[1] = options,
  ) =>
    tiers.map((tier, i) =>
      ai.model(tier, i === tiers.length - 1 ? last : options),
    )
  const models = {
    'anthropic/claude-opus-5': mock('anthropic/claude-opus-5'),
    'anthropic/claude-sonnet-5': mock('anthropic/claude-sonnet-5'),
    'openai/gpt-5': mock('openai/gpt-5'),
  }
  const calls = () =>
    Object.values(models).map(
      (m) => m.doGenerateCalls.length + m.doStreamCalls.length,
    )

  // Opus has room: no fallback, and no providerOptions.void leaks to the provider.
  {
    const server = serve(generous)
    const void_ = client(server)
    const fell: string[] = []
    await withDefaultProvider(models, async () => {
      const model = fallback(
        ladder(void_.as('org_1').ai, { tags: { feature: 'chat' } }),
        {
          onFallback: ({ to }) => {
            fell.push(to)
          },
        },
      )
      const { text } = await generateText({ model, prompt: 'hi' })
      assert.equal(text, 'hello from anthropic/claude-opus-5')
    })
    assert.deepEqual(calls(), [1, 0, 0])
    assert.deepEqual(fell, [])
    assert.deepEqual(
      Object.keys(
        models['anthropic/claude-opus-5'].doGenerateCalls[0]?.providerOptions ??
          {},
      ),
      ['gateway'],
    )
    const m = metadata(server.posts[0])
    assert.equal(m.model, 'anthropic/claude-opus-5')
    assert.equal(m.fallback_from, null)
    await void_.dispose()
  }

  // Opus is capped: Sonnet runs, the fallback is recorded and reported.
  {
    const server = serve({
      ...generous,
      'llm-output-anthropic-claude-opus-5': 10,
    })
    const void_ = client(server)
    const fell: Array<{ to: string; skipped: string[] }> = []
    await withDefaultProvider(models, async () => {
      const model = fallback(
        ladder(void_.as('org_1').ai, { tags: { feature: 'chat' } }),
        {
          onFallback: ({ to, skipped }) => {
            fell.push({
              to,
              skipped: skipped.map((s) => `${s.model}:${s.check.reason}`),
            })
          },
        },
      )
      const { text } = await generateText({ model, prompt: 'hi' })
      assert.equal(text, 'hello from anthropic/claude-sonnet-5')
    })
    // The ladder's check passed Sonnet, so its own gate did not run again.
    assert.deepEqual(calls(), [1, 1, 0])
    assert.deepEqual(fell, [
      {
        to: 'anthropic/claude-sonnet-5',
        skipped: ['anthropic/claude-opus-5:cap'],
      },
    ])
    const m = metadata(server.posts[0])
    assert.equal(m.model, 'anthropic/claude-sonnet-5')
    assert.equal(m.fallback_from, 'anthropic/claude-opus-5')
    await void_.dispose()
  }

  // Low on Opus but not out: minRemaining steps down early, streaming too.
  {
    const server = serve({
      ...generous,
      'llm-output-anthropic-claude-opus-5': 900,
    })
    const void_ = client(server)
    await withDefaultProvider(models, async () => {
      const model = fallback(
        ladder(void_.as('org_1').ai, {
          tags: { feature: 'chat' },
          minRemaining: 1_000,
        }),
      )
      const result = streamText({ model, prompt: 'hi', maxOutputTokens: 100 })
      for await (const _ of result.textStream) void _
    })
    assert.deepEqual(calls(), [1, 2, 0])
    assert.equal(
      metadata(server.posts[0]).fallback_from,
      'anthropic/claude-opus-5',
    )
    await void_.dispose()
  }

  // Every tier capped: the last tier's own gate decides, and every skipped
  // tier is reported.
  {
    const server = serve({
      ...generous,
      'llm-output-anthropic-claude-opus-5': 0,
      'llm-output-anthropic-claude-sonnet-5': 0,
      'llm-output-other': 0,
    })
    const void_ = client(server)
    await withDefaultProvider(models, async () => {
      const skipped: string[][] = []
      const onFallback = ({ skipped: s }: { skipped: readonly Skipped[] }) => {
        skipped.push(s.map((t) => t.model))
      }
      const blocking = fallback(
        ladder(void_.as('org_1').ai, { tags: { feature: 'chat' } }),
        { onFallback },
      )
      await expect(
        generateText({ model: blocking, prompt: 'hi' }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof VoidError && error.message.includes('openai/gpt-5'),
      )
      const opts = { tags: { feature: 'chat' } } as const
      const lenient = fallback(
        ladder(void_.as('org_1').ai, opts, { ...opts, gate: 'off' }),
        { onFallback },
      )
      const { text } = await generateText({ model: lenient, prompt: 'hi' })
      assert.equal(text, 'hello from openai/gpt-5')
      assert.deepEqual(skipped, [
        ['anthropic/claude-opus-5', 'anthropic/claude-sonnet-5'],
        ['anthropic/claude-opus-5', 'anthropic/claude-sonnet-5'],
      ])
    })
    assert.deepEqual(calls(), [1, 2, 1])
    assert.equal(server.posts.length, 1)
    await void_.dispose()
  }
})

it('telemetry records every step with its call id, without touching the model', async () => {
  const server = serve(generous)
  const void_ = client(server)

  // Per call, bound to one identity.
  const one = await generateText({
    model: mock(),
    prompt: 'hi',
    telemetry: {
      integrations: [void_.as('org_1').ai.telemetry({ feature: 'x' })],
    },
  })
  assert.equal(server.posts.length, 1)
  assert.equal(server.posts[0]?.external_identity_id, 'org_1')
  const first = metadata(server.posts[0])
  assert.equal(first.feature, 'x')
  assert.equal(first.cost, 0.0021)
  assert.equal(first.call_id, one.steps[0]?.callId)
  assert.equal(first.step, 0)
  assert.equal(first.response_id, 'resp_1')

  // Process wide: the ambient scope wins, `identity` is the fallback,
  // tags may come from the step.
  const dropped: string[] = []
  const global = ai.telemetry(void_, {
    tags: (step) => ({
      feature: String(step.runtimeContext?.feature ?? 'unknown'),
    }),
    onUnknownIdentity: (step) => dropped.push(step.model.modelId),
  })
  await void_.as('org_2').run(() =>
    generateText({
      model: mock(),
      prompt: 'hi',
      runtimeContext: { feature: 'summaries' },
      telemetry: {
        integrations: [global],
        includeRuntimeContext: { feature: true },
      },
    }),
  )
  assert.equal(server.posts[1]?.external_identity_id, 'org_2')
  assert.equal(metadata(server.posts[1]).feature, 'summaries')

  await generateText({
    model: mock(),
    prompt: 'hi',
    runtimeContext: { voidIdentity: 'org_3' },
    telemetry: {
      integrations: [global],
      includeRuntimeContext: { voidIdentity: true },
    },
  })
  assert.equal(server.posts[2]?.external_identity_id, 'org_3')
  assert.equal(metadata(server.posts[2]).feature, 'unknown')

  await generateText({
    model: mock(),
    prompt: 'hi',
    telemetry: { integrations: [global] },
  })
  assert.equal(server.posts.length, 3)
  assert.deepEqual(dropped, ['anthropic/claude-sonnet-5'])
  await void_.dispose()
})

it('a wrapped model and telemetry together record once', async () => {
  const server = serve(generous)
  const void_ = client(server)
  const org = void_.as('org_1')
  const global = ai.telemetry(void_, { tags: { feature: 'global' } })
  const wrapped = org.ai.model(mock(), {
    tags: { feature: 'wrapped' },
    gate: 'off',
  })

  await org.run(() =>
    generateText({
      model: wrapped,
      prompt: 'hi',
      telemetry: { integrations: [global] },
    }),
  )
  assert.equal(server.posts.length, 1)
  assert.equal(metadata(server.posts[0]).feature, 'wrapped')

  const result = streamText({
    model: wrapped,
    prompt: 'hi',
    telemetry: { integrations: [global] },
  })
  for await (const _ of result.textStream) void _
  assert.equal(server.posts.length, 2)
  await void_.dispose()
})

it('telemetry from a config that does not export the plugin is rejected', () => {
  const server = serve(generous)
  const otherConfig = defineConfig({ schema: {} })
  const void_ = createVoid(otherConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  expect(() => ai.telemetry(void_, { tags: { feature: 'x' } })).toThrow(
    'not exported by the client config',
  )
})

it('createVoid captures every call itself, once per plugin, following the latest client', async () => {
  const server = serve(generous)
  // Registered when the client was created: no integrations passed here.
  // The scope's tags are the completion's tags.
  const first = client(server)
  await first
    .as('org_1')
    .run(() => generateText({ model: mock(), prompt: 'hi' }), {
      feature: 'auto',
    })
  assert.equal(server.posts.length, 1)
  assert.equal(server.posts[0]?.external_identity_id, 'org_1')
  assert.equal(metadata(server.posts[0]).feature, 'auto')

  // Nested runs of the same identity inherit and override tags; a step
  // outside any tagged run carries none.
  await first.as('org_1').run(
    () =>
      first
        .as('org_1')
        .run(() => generateText({ model: mock(), prompt: 'hi' }), {
          feature: 'inner',
        }),
    { feature: 'outer' },
  )
  assert.equal(metadata(server.posts[1]).feature, 'inner')
  await first
    .as('org_1')
    .run(() => generateText({ model: mock(), prompt: 'hi' }))
  assert.equal(metadata(server.posts[2]).feature, undefined)
  assert.equal(server.posts.length, 3)

  // A second client from the same config takes over; the first is disposed.
  await first.dispose()
  const other = serve(generous)
  const second = client(other)
  await second
    .as('org_2')
    .run(() => generateText({ model: mock(), prompt: 'hi' }))
  assert.equal(server.posts.length, 3)
  assert.equal(other.posts.length, 1)
  assert.equal(other.posts[0]?.external_identity_id, 'org_2')

  // Disposed: nothing records anywhere, and the call itself is unaffected.
  await second.dispose()
  const { text } = await generateText({ model: mock(), prompt: 'hi' })
  assert.equal(text, 'hello from anthropic/claude-sonnet-5')
  assert.equal(other.posts.length, 1)
})

it('capture: false leaves only the wrapped model recording', async () => {
  const quiet = llm({
    gateway: vercelGateway(),
    key: 'quiet',
    models: [],
    billing: perToken({
      other: { input: usd(0.000001), output: usd(0.000002) },
    }),
    capture: false,
  })
  const quietConfig = defineConfig({ schema: { quiet } })
  const quietIr = compile(quietConfig)
  const posts: Array<Record<string, Json>> = []
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(
      input instanceof Request ? input.url : input,
    ).pathname.replace(/^\/v1\/void(?=\/|$)/, '')
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status })
    if (path === '/reducers')
      return json(
        quietIr.reducers.map((r) => ({
          id: `r-${r.slug}`,
          slug: r.slug,
          created_at: 'a',
          type: 'scalar',
          filter: r.filter,
          aggregation: r.aggregation,
        })),
      )
    if (path === '/meters')
      return json(
        quietIr.meters.map((m) => ({
          id: `m-${m.slug}`,
          name: m.slug,
          slug: m.slug,
          generation_id: 1,
          branch_id: null,
          usage_reducer_id: `r-${m.slug}`,
          credit_reducer_id: `r-${m.slug}-credits`,
          unit_amount: String(m.unit_amount),
          currency: 'usd',
          created_at: 'a',
        })),
      )
    if (path === '/organizations/current')
      return json({ id: 'org', name: 'Org', slug: 'org', created_at: 'a' })
    if (path === '/events' && init?.method === 'POST') {
      const raw = init.body
      const rows = JSON.parse(
        raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw),
      ) as Record<string, Json>[]
      posts.push(...rows)
      return json({ saved: rows.length, ignored: 0 }, 202)
    }
    return json({ error: 'ResourceNotFound', detail: path }, 404)
  }
  const void_ = createVoid(quietConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch,
  })
  const org = void_.as('org_1')
  await org.run(() => generateText({ model: mock(), prompt: 'hi' }))
  assert.equal(posts.length, 0)
  await generateText({
    model: org.quiet.model(mock(), { gate: 'off' }),
    prompt: 'hi',
  })
  assert.equal(posts.length, 1)
  assert.equal(posts[0]?.name, 'quiet.completion')
  await void_.dispose()
})

// ---- the other billing modes -----------------------------------------------

/** A server for one config: meters by slug, one shared remaining balance per meter. */
const serveFor = (
  cfg: ReturnType<typeof defineConfig>,
  remaining: Record<string, number>,
) => {
  const own = compile(cfg)
  const posts: Array<Record<string, Json>> = []
  const checks: Array<{ slug: string; size: number }> = []
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status })
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(
      input instanceof Request ? input.url : input,
    )
    const path = pathname.replace(/^\/v1\/void(?=\/|$)/, '')
    if (path === '/reducers')
      return json(
        own.reducers.map((r) => ({
          id: `r-${r.slug}`,
          slug: r.slug,
          created_at: 'a',
          type: 'scalar',
          filter: r.filter,
          aggregation: r.aggregation,
        })),
      )
    if (path === '/meters')
      return json(
        own.meters.map((m) => ({
          id: `m-${m.slug}`,
          name: m.slug,
          slug: m.slug,
          generation_id: 1,
          branch_id: null,
          usage_reducer_id: `r-${m.reducer}`,
          credit_reducer_id: m.credit_reducer
            ? `r-${m.credit_reducer}`
            : `r-${m.slug}-credits`,
          unit_amount: String(m.unit_amount),
          currency: 'usd',
          created_at: 'a',
        })),
      )
    const check = path.match(/^\/meters\/m-(.+)\/check$/)
    if (check) {
      const slug = check[1]!
      const size = Number(searchParams.get('size'))
      checks.push({ slug, size })
      const left = remaining[slug] ?? 0
      const allowed = left >= size
      return json({
        allowed,
        reason: allowed ? 'ok' : 'exhausted',
        remaining: left,
        overage: 0,
        limit: 'hard',
        external_identity_id: 'org_1',
      })
    }
    if (path === '/events' && init?.method === 'POST') {
      const raw = init.body
      const rows = JSON.parse(
        raw instanceof Uint8Array ? new TextDecoder().decode(raw) : String(raw),
      ) as Record<string, Json>[]
      posts.push(...rows)
      return json({ saved: rows.length, ignored: 0 }, 202)
    }
    if (path === '/organizations/current')
      return json({ id: 'org', name: 'Org', slug: 'org', created_at: 'a' })
    return json({ error: 'ResourceNotFound', detail: path }, 404)
  }
  return { fetch, posts, checks }
}

// No price table: list prices come from the gateway's model catalogue.
const plus = llm({
  gateway: vercelGateway(),
  key: 'plus',
  models: ['anthropic/claude-sonnet-5'],
  billing: costPlus({ markup: percent(40) }),
  capture: false,
})
/** The gateway's catalogue, priced like `prices` but as the gateway reports it. */
const stubGatewayModels = (ids: readonly string[]) =>
  vi.spyOn(aiGateway, 'getAvailableModels').mockResolvedValue({
    models: ids.map((id) => ({
      id,
      name: id,
      specification: {
        specificationVersion: 'v3',
        provider: id.split('/')[0]!,
        modelId: id,
      },
      modelType: 'language',
      pricing: {
        input: String(prices['anthropic/claude-sonnet-5'].input.amount),
        output: String(prices['anthropic/claude-sonnet-5'].output.amount),
      },
    })),
  } as never)
const plusPro = product('plus_pro', {
  name: 'Plus',
  price: recurring({ interval: 'month', amount: usd(20) }),
  meters: [included(plus.spend, 20, { limit: 'hard' })],
})
const plusConfig = defineConfig({ schema: { plus, plusPro } })

it('cost plus compiles to one spend meter priced at the markup, with token totals as plain reducers', () => {
  const ir = compile(plusConfig)
  assert.deepEqual(
    ir.meters.map((m) => [m.slug, m.unit_amount]),
    [
      ['plus-cost', 0],
      ['plus-spend', 1.4],
    ],
  )
  assert.deepEqual(ir.reducers.map((r) => r.slug).sort(), [
    'plus-completions',
    'plus-cost',
    'plus-input-anthropic-claude-sonnet-5',
    'plus-input-other',
    'plus-output-anthropic-claude-sonnet-5',
    'plus-output-other',
    'plus-spend',
  ])
  assert.deepEqual(ir.products[0]?.meters, [
    { slug: 'plus-spend', included: 20, limit: 'hard', rollover_cap: 0 },
  ])
})

it('cost plus gates on an estimated dollar cost and records the gateway cost, or the list cost without a gateway', async () => {
  const catalogue = stubGatewayModels(['anthropic/claude-sonnet-5'])
  const server = serveFor(plusConfig, { 'plus-spend': 1 })
  const void_ = createVoid(plusConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const org = void_.as('org_1')
  const model = org.plus.model(mock(), { maxOutputTokens: 1_000 })
  await generateText({ model, prompt: 'Say hello' })
  // "Say hello" estimates to 3 input tokens at 0.000003, plus 1000 output at
  // 0.000015, both from the gateway's catalogue, fetched once.
  assert.deepEqual(server.checks, [{ slug: 'plus-spend', size: 0.015009 }])
  assert.equal(catalogue.mock.calls.length, 1)
  const m = metadata(server.posts[0])
  assert.equal(m.cost, 0.0021)
  assert.equal(m.cost_source, 'gateway')

  // No gateway metadata: the list price stands in.
  const bare = new MockLanguageModelV4({
    provider: 'anthropic',
    modelId: 'anthropic/claude-sonnet-5',
    doGenerate: {
      content: [{ type: 'text', text: 'hi' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    },
  })
  await generateText({
    model: org.plus.model(bare, { gate: 'off' }),
    prompt: 'hi',
  })
  const listed = metadata(server.posts[1])
  assert.equal(listed.cost, 0.00096) // 120 in at 0.000003 + 40 out at 0.000015, float noise trimmed
  assert.equal(listed.cost_source, 'list')

  // A model the catalogue does not price: the gate can only deny a spent cap
  // and, off the gateway, the cost is recorded as unknown rather than free.
  const unknown = new MockLanguageModelV4({
    provider: 'acme',
    modelId: 'acme/mystery',
    doGenerate: {
      content: [{ type: 'text', text: 'hi' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    },
  })
  await generateText({ model: org.plus.model(unknown), prompt: 'hi' })
  assert.deepEqual(server.checks.at(-1), { slug: 'plus-spend', size: 0.000001 })
  const unpriced = metadata(server.posts[2])
  assert.equal(unpriced.cost, null)
  assert.equal(unpriced.cost_source, null)

  // The spend meter is a verb; token totals are plain reducers.
  expectTypeOf(org.plus.spend.check).toBeFunction()
  expectTypeOf(
    org.plus.models['anthropic/claude-sonnet-5'].input.total,
  ).toBeFunction()
  // @ts-expect-error not a meter outside per-token billing
  void org.plus.models['anthropic/claude-sonnet-5'].input.check

  // Over budget: denied in dollars.
  const denied: BillingCheckLike[] = []
  const tight = org.plus.model(mock(), {
    maxOutputTokens: 100_000,
    onDenied: ({ check }) => {
      if (check) denied.push({ unit: check.unit, reason: check.reason })
    },
  })
  await expect(generateText({ model: tight, prompt: 'hi' })).rejects.toThrow(
    'denied by gate',
  )
  assert.deepEqual(denied, [{ unit: 'usd', reason: 'cap' }])
  catalogue.mockRestore()
  await void_.dispose()
})
type BillingCheckLike = { unit: string; reason: string }

const wallet = llm({
  gateway: vercelGateway(),
  key: 'wallet',
  models: ['anthropic/claude-sonnet-5', 'openai/gpt-5'],
  billing: inCredits({
    rates: {
      'anthropic/claude-sonnet-5': perThousandOutput(3),
      'openai/gpt-5': perThousandOutput(1),
      other: perCall(5),
    },
  }),
  tags: tags<{ feature: string }>(),
  capture: false,
})
const walletPro = product('wallet_pro', {
  name: 'Wallet',
  price: recurring({ interval: 'month', amount: usd(10) }),
  meters: [included(wallet.credits, 1_000, { limit: 'hard' })],
})
const walletConfig = defineConfig({ schema: { wallet, walletPro } })

it('credits compiles to a pool over the completion event with its own grant event', () => {
  const ir = compile(walletConfig)
  assert.deepEqual(
    ir.events.map((e) => e.name),
    ['wallet.completion', 'wallet.granted'],
  )
  assert.deepEqual(
    ir.meters.map((m) => [m.slug, m.reducer, m.credit_reducer, m.unit_amount]),
    [
      ['wallet-cost', 'wallet-cost', undefined, 0],
      ['wallet-credits', 'wallet-credits', 'wallet-granted', 0],
    ],
  )
  const pool = ir.reducers.find((r) => r.slug === 'wallet-credits')
  assert.deepEqual(pool?.aggregation, { func: 'sum', property: 'credits' })
  assert.deepEqual(ir.products[0]?.meters, [
    { slug: 'wallet-credits', included: 1_000, limit: 'hard', rollover_cap: 0 },
  ])
})

it('credits converts every completion with the model rate, gates on the pool, grants, and ladders by credits', async () => {
  const server = serveFor(walletConfig, { 'wallet-credits': 10 })
  const void_ = createVoid(walletConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const org = void_.as('org_1')

  // 40 output tokens at 3 per thousand is 0.12, rounded up to one credit.
  const sonnet = org.wallet.model(mock(), {
    tags: { feature: 'chat' },
    maxOutputTokens: 1_000,
  })
  await generateText({ model: sonnet, prompt: 'hi' })
  assert.deepEqual(server.checks, [{ slug: 'wallet-credits', size: 3 }])
  const first = metadata(server.posts[0])
  assert.equal(first.credits, 1)
  assert.equal(first.cost, 0.0021)
  assert.equal(first.feature, 'chat')

  // An unknown model bills the flat per-call rate.
  const stranger = org.wallet.model(mock('mistral/large'), {
    tags: { feature: 'chat' },
  })
  await generateText({ model: stranger, prompt: 'hi' })
  assert.equal(metadata(server.posts[1]).credits, 5)
  assert.equal(server.checks[1]?.size, 5)

  // Too big for what is left: denied in credits.
  const big = org.wallet.model(mock(), {
    tags: { feature: 'chat' },
    maxOutputTokens: 10_000, // 30 credits
  })
  await expect(generateText({ model: big, prompt: 'hi' })).rejects.toThrow(
    'denied by gate for org_1 (cap)',
  )

  // Grants land on the pool's own event; the pool is a meter verb.
  await org.wallet.grant(500, { reason: 'referral' }, { id: 'g1' })
  const grant = server.posts[2]!
  assert.equal(grant.name, 'wallet.granted')
  assert.deepEqual(metadata(grant), { reason: 'referral', amount: 500 })
  expectTypeOf(org.wallet.credits.balance).toBeFunction()

  // A ladder steps down when fewer credits remain than `minRemaining`.
  const models = {
    'anthropic/claude-sonnet-5': mock('anthropic/claude-sonnet-5'),
    'openai/gpt-5': mock('openai/gpt-5'),
  }
  await withDefaultProvider(models, async () => {
    const opts = {
      tags: { feature: 'chat' },
      minRemaining: 50,
      maxOutputTokens: 100,
    }
    const ladder = fallback([
      org.wallet.model('anthropic/claude-sonnet-5', opts),
      org.wallet.model('openai/gpt-5', opts),
    ])
    const { text } = await generateText({ model: ladder, prompt: 'hi' })
    assert.equal(text, 'hello from openai/gpt-5')
  })
  const fell = metadata(server.posts[3])
  assert.equal(fell.fallback_from, 'anthropic/claude-sonnet-5')
  assert.equal(fell.credits, 1)

  // `record` converts too, unless the caller already priced it.
  await org.wallet.record({
    model: 'openai/gpt-5',
    input_tokens: 10,
    output_tokens: 2_500,
    feature: 'batch',
  })
  assert.equal(metadata(server.posts[4]).credits, 3)
  await org.wallet.record({
    model: 'openai/gpt-5',
    input_tokens: 10,
    output_tokens: 2_500,
    credits: 42,
    feature: 'batch',
  })
  assert.equal(metadata(server.posts[5]).credits, 42)

  const snapshotType = null as unknown as Awaited<
    ReturnType<typeof org.snapshot>
  >['meters']['wallet']
  expectTypeOf(snapshotType).toHaveProperty('credits')
  expectTypeOf(snapshotType).toHaveProperty('cost')
  // @ts-expect-error grant does not exist outside credits billing
  void org.plus?.grant
  await void_.dispose()
})

it('the billing table must name every model and nothing else', () => {
  expect(() =>
    llm({
      gateway: vercelGateway(),
      models: ['a'],
      billing: perToken({ other: prices.other } as never),
    }),
  ).toThrow('no entry for model a')
  expect(() =>
    llm({
      gateway: vercelGateway(),
      models: ['a'],
      billing: inCredits({
        rates: { a: perCall(1), b: perCall(1), other: perCall(1) } as never,
      }),
    }),
  ).toThrow('prices b, which is not in models')
})

// ---- gateways --------------------------------------------------------------

/** OpenRouter's public catalogue, as `GET /api/v1/models` returns it. */
const stubOpenRouterCatalogue = (ids: readonly string[]) =>
  vi.fn(async (_input: string | URL | Request) =>
    Response.json({
      data: ids.map((id) => ({
        id,
        name: id,
        pricing: {
          prompt: String(prices['anthropic/claude-sonnet-5'].input.amount),
          completion: String(prices['anthropic/claude-sonnet-5'].output.amount),
        },
      })),
    }),
  )
const catalogue = stubOpenRouterCatalogue(['anthropic/claude-sonnet-5'])
const routed = llm({
  key: 'routed',
  models: ['anthropic/claude-sonnet-5'],
  billing: costPlus({ markup: percent(40) }),
  gateway: openrouter({ fetch: catalogue as unknown as typeof fetch }),
  capture: false,
})
const routedPro = product('routed_pro', {
  name: 'Routed',
  price: recurring({ interval: 'month', amount: usd(20) }),
  meters: [included(routed.spend, 20, { limit: 'hard' })],
})
const routedConfig = defineConfig({ schema: { routed, routedPro } })

/** A model as `@openrouter/ai-sdk-provider` answers, with usage accounting on. */
const openrouterMock = (cost: number | null = 0.0021) =>
  new MockLanguageModelV4({
    provider: 'openrouter',
    modelId: 'anthropic/claude-sonnet-5',
    doGenerate: {
      content: [{ type: 'text', text: 'hi' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      providerMetadata: {
        openrouter: {
          provider: 'Anthropic',
          usage: {
            promptTokens: 120,
            completionTokens: 40,
            totalTokens: 160,
            ...(cost === null ? {} : { cost }),
          },
        },
      },
      response: {
        id: 'gen-abc',
        modelId: 'anthropic/claude-sonnet-5',
        timestamp: new Date(0),
      },
      warnings: [],
    },
  })

it('openrouter: the gate prices from the catalogue, the request asks for usage accounting as the identity, and the cost is recorded from it', async () => {
  const server = serveFor(routedConfig, { 'routed-spend': 1 })
  const void_ = createVoid(routedConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const org = void_.as('org_1')
  const priced = openrouterMock()
  await generateText({
    model: org.routed.model(priced, { maxOutputTokens: 1_000 }),
    prompt: 'Say hello',
  })
  // Same estimate as the Vercel catalogue gives: the prices are the same.
  assert.deepEqual(server.checks, [{ slug: 'routed-spend', size: 0.015009 }])
  assert.equal(catalogue.mock.calls.length, 1)
  assert.equal(
    String(catalogue.mock.calls[0]?.[0]),
    'https://openrouter.ai/api/v1/models',
  )
  assert.deepEqual(priced.doGenerateCalls[0]?.providerOptions, {
    openrouter: { user: 'org_1', usage: { include: true } },
  })
  const m = metadata(server.posts[0])
  assert.equal(m.provider, 'openrouter')
  assert.equal(m.cost, 0.0021)
  assert.equal(m.cost_source, 'openrouter')
  assert.equal(m.generation_id, 'gen-abc')
  assert.equal(m.response_id, 'gen-abc')

  // The caller's own openrouter options survive; ours are merged in.
  const theirs = openrouterMock()
  await generateText({
    model: org.routed.model(theirs, { gate: 'off' }),
    prompt: 'hi',
    providerOptions: {
      openrouter: {
        user: 'their-user',
        usage: { include: false },
        route: 'fallback',
      },
    },
  })
  assert.deepEqual(theirs.doGenerateCalls[0]?.providerOptions, {
    openrouter: {
      user: 'their-user',
      usage: { include: true },
      route: 'fallback',
    },
  })

  // No cost in the response: the catalogue's list price stands in.
  const unpriced = openrouterMock(null)
  await generateText({
    model: org.routed.model(unpriced, { gate: 'off' }),
    prompt: 'hi',
  })
  const listed = metadata(server.posts[2])
  assert.equal(listed.cost, 0.00096)
  assert.equal(listed.cost_source, 'list')
  await void_.dispose()
})

it('openrouter: a bare model id needs a provider', async () => {
  const server = serveFor(routedConfig, { 'routed-spend': 1 })
  const void_ = createVoid(routedConfig, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  let thrown: unknown
  try {
    void_.as('org_1').routed.model('anthropic/claude-sonnet-5')
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown instanceof VoidError)
  assert.equal(thrown.reason, 'invalid_argument')
  assert.match(thrown.message, /openrouter\(\{ provider/)
  await void_.dispose()

  const resolved = openrouterMock()
  const withProvider = llm({
    key: 'resolved',
    models: ['anthropic/claude-sonnet-5'],
    billing: costPlus(),
    gateway: openrouter({
      provider: { languageModel: () => resolved },
      fetch: catalogue as unknown as typeof fetch,
    }),
    capture: false,
  })
  const cfg = defineConfig({ schema: { withProvider } })
  const own = serveFor(cfg, {})
  const client_ = createVoid(cfg, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: own.fetch,
  })
  await generateText({
    model: client_
      .as('org_1')
      .withProvider.model('anthropic/claude-sonnet-5', { gate: 'off' }),
    prompt: 'hi',
  })
  assert.equal(resolved.doGenerateCalls.length, 1)
  assert.equal(metadata(own.posts[0]).cost_source, 'openrouter')
  await client_.dispose()
})

// ---- model names -----------------------------------------------------------

it('canonicalModel names what a provider reported as the merchant does', () => {
  const names = [
    'anthropic/claude-sonnet-5',
    'openai/gpt-5',
    'openai/gpt-5-mini',
  ]
  const name = (provider: string, id: string) =>
    canonicalModel(names, provider, id)
  // Gateways already say vendor/model.
  assert.equal(name('gateway', 'openai/gpt-5'), 'openai/gpt-5')
  assert.equal(name('openrouter', 'acme/mystery'), 'acme/mystery')
  // Direct providers: the vendor is the provider name up to its first dot.
  assert.equal(name('openai.responses', 'gpt-5'), 'openai/gpt-5')
  assert.equal(
    name('anthropic.messages', 'claude-sonnet-5'),
    'anthropic/claude-sonnet-5',
  )
  // Azure deployments named after the model match on the whole tail.
  assert.equal(name('azure.responses', 'gpt-5'), 'openai/gpt-5')
  // Bedrock and dated variants extend a listed tail past a separator.
  assert.equal(
    name('amazon-bedrock', 'anthropic.claude-sonnet-5-v1:0'),
    'anthropic/claude-sonnet-5',
  )
  assert.equal(name('openai.chat', 'gpt-5-2026-03-01'), 'openai/gpt-5')
  // The longest listed tail wins.
  assert.equal(
    name('openai.chat', 'gpt-5-mini-2026-03-01'),
    'openai/gpt-5-mini',
  )
  // Nothing matches: the provider-derived name stands, and bills as other.
  assert.equal(name('acme.chat', 'mystery'), 'acme/mystery')
  assert.equal(name('acme.chat', 'gpt-50'), 'acme/gpt-50')
})

it('a direct provider bills its named model, and an unknown model is reported once', async () => {
  const unknown: string[] = []
  const direct = llm({
    key: 'direct',
    models: ['openai/gpt-5'],
    billing: perToken({
      'openai/gpt-5': prices['openai/gpt-5'],
      other: prices.other,
    }),
    onUnknownModel: (m) => {
      unknown.push(`${m.provider} ${m.modelId} -> ${m.canonical}`)
    },
    capture: false,
  })
  const cfg = defineConfig({ schema: { direct } })
  const server = serveFor(cfg, {
    'direct-input-openai-gpt-5': 1_000_000,
    'direct-output-openai-gpt-5': 1_000_000,
    'direct-input-other': 1_000_000,
    'direct-output-other': 1_000_000,
  })
  const void_ = createVoid(cfg, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const org = void_.as('org_1')
  const asDirect = (provider: string, modelId: string) =>
    new MockLanguageModelV4({
      provider,
      modelId,
      doGenerate: {
        content: [{ type: 'text', text: 'hi' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      },
    })

  await generateText({
    model: org.direct.model(asDirect('openai.responses', 'gpt-5')),
    prompt: 'hi',
  })
  assert.deepEqual(server.checks.map((c) => c.slug).sort(), [
    'direct-input-openai-gpt-5',
    'direct-output-openai-gpt-5',
  ])
  const m = metadata(server.posts[0])
  assert.equal(m.model, 'openai/gpt-5')
  assert.equal(m.provider, 'openai.responses')
  assert.equal(m.cost, 0.00056) // list price: 120 in at 0.000002 + 40 out at 0.000008
  assert.deepEqual(unknown, [])

  // An unlisted model bills as other and is reported once, not per call.
  const mystery = org.direct.model(asDirect('acme.chat', 'mystery'))
  await generateText({ model: mystery, prompt: 'hi' })
  await generateText({ model: mystery, prompt: 'hi' })
  assert.deepEqual(
    server.checks
      .slice(2)
      .map((c) => c.slug)
      .sort(),
    [
      'direct-input-other',
      'direct-input-other',
      'direct-output-other',
      'direct-output-other',
    ],
  )
  assert.equal(metadata(server.posts[1]).model, 'acme/mystery')
  assert.deepEqual(unknown, ['acme.chat mystery -> acme/mystery'])
  await void_.dispose()
})

it('cost plus refuses a gateway that reports no cost, prices or not', () => {
  const direct = { ...vercelGateway(), name: 'direct', reportsCost: false }
  expect(() =>
    llm({
      key: 'bare',
      models: ['openai/gpt-5'],
      billing: costPlus(),
      gateway: direct,
      capture: false,
    }),
  ).toThrow(/costPlus bills what the gateway charged/)
  // A price table does not make it cost plus: there is still no actual cost.
  expect(() =>
    llm({
      key: 'tabled',
      models: ['openai/gpt-5'],
      billing: costPlus({
        prices: { 'openai/gpt-5': prices['openai/gpt-5'], other: prices.other },
      }),
      gateway: direct,
      capture: false,
    }),
  ).toThrow(/costPlus bills what the gateway charged/)
  // A cost-reporting gateway without a catalogue still needs prices to gate on.
  expect(() =>
    llm({
      key: 'uncatalogued',
      models: ['openai/gpt-5'],
      billing: costPlus(),
      gateway: { ...openrouter(), prices: undefined },
      capture: false,
    }),
  ).toThrow(/costPlus needs list prices/)
})

// ---- no gateway ------------------------------------------------------------

it('direct is the default: nothing stamped, no cost, and a bare id needs a default provider', async () => {
  const plain = llm({
    key: 'plain',
    models: ['openai/gpt-5'],
    billing: perToken({
      'openai/gpt-5': prices['openai/gpt-5'],
      other: prices.other,
    }),
    capture: false,
  })
  const cfg = defineConfig({ schema: { plain } })
  const server = serveFor(cfg, {
    'plain-input-openai-gpt-5': 1_000_000,
    'plain-output-openai-gpt-5': 1_000_000,
  })
  const void_ = createVoid(cfg, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const org = void_.as('org_1')
  // A response that happens to carry gateway metadata: direct does not read it.
  const gpt = new MockLanguageModelV4({
    provider: 'openai.responses',
    modelId: 'gpt-5',
    doGenerate: {
      content: [{ type: 'text', text: 'hi' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      providerMetadata: gateway,
      response: { id: 'resp_9', modelId: 'gpt-5', timestamp: new Date(0) },
      warnings: [],
    },
  })
  await generateText({
    model: org.plain.model(gpt, { tags: { feature: 'chat' } }),
    prompt: 'hi',
  })
  assert.equal(gpt.doGenerateCalls[0]?.providerOptions, undefined)
  const m = metadata(server.posts[0])
  assert.equal(m.model, 'openai/gpt-5')
  assert.equal(m.cost, 0.00056)
  assert.equal(m.cost_source, 'list')
  assert.equal(m.generation_id, null)
  assert.equal(m.response_id, 'resp_9')

  let thrown: unknown
  try {
    org.plain.model('openai/gpt-5')
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown instanceof VoidError)
  assert.match(thrown.message, /without a gateway/)
  await withDefaultProvider({ 'openai/gpt-5': gpt }, async () => {
    await generateText({ model: org.plain.model('openai/gpt-5'), prompt: 'hi' })
  })
  assert.equal(gpt.doGenerateCalls.length, 2)
  await void_.dispose()
})

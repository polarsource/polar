import { assert, it } from '@effect/vitest'
import {
  checksum,
  compile,
  count,
  defineConfig,
  entitlement,
  included,
  event,
  gt,
  meter,
  money,
  on,
  oneTime,
  product,
  recurring,
  signal,
  sum,
  unlimited,
  usd,
  type MetadataOf,
} from '../src/config/index'

const aiCall = event<{
  tokens: number
  model: string
  status?: string
}>('ai_call')

const tokens = meter('tokens', {
  reducer: sum(aiCall, 'tokens'),
  price: { amount: 0.000002, currency: 'usd' },
})

const successfulCalls = count(
  'successful_calls',
  on(aiCall, { status: 'ok', tokens: gt(0) }),
)

const schema = {
  aiCall,
  tokens,
  successfulCalls,
  unrelated: 42,
  helper: () => 1,
}

it('lookup versions do not change the published config checksum', () => {
  const baseline = compile(defineConfig({ schema }))
  const candidate = compile(defineConfig({ schema, versionId: 'candidate' }))
  assert.deepEqual(candidate, baseline)
  assert.equal(checksum(baseline), checksum(candidate))
  assert.deepEqual(candidate.meters, baseline.meters)
  assert.deepEqual(candidate.reducers, baseline.reducers)
  assert.throws(() => defineConfig({ schema, versionId: '' }))
})

// oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
if (false) {
  const _ok: MetadataOf<typeof aiCall> = { tokens: 1, model: 'gpt-4' }
  const _withStatus: MetadataOf<typeof aiCall> = {
    tokens: 1,
    model: 'gpt-4',
    status: 'ok',
  }
  // @ts-expect-error tokens is required
  const _missing: MetadataOf<typeof aiCall> = { model: 'gpt-4' }
  // @ts-expect-error model is a string
  const _wrong: MetadataOf<typeof aiCall> = { tokens: 1, model: 4 }
  // @ts-expect-error only numeric properties can be summed
  sum(aiCall, 'model')
}

it('defineConfig collects definitions from the module and lends meter keys', () => {
  const config = defineConfig({ schema })
  assert.deepEqual(
    config.events.map((e) => e.name),
    ['ai_call'],
  )
  assert.deepEqual(config.reducers.map((r) => r.key).sort(), [
    'successful_calls',
    'tokens',
  ])
  assert.equal(config.meters[0]!.reducer.key, 'tokens')
})

it('defineConfig rejects a keyless reducer exported on its own', () => {
  assert.throws(
    () => defineConfig({ schema: { loose: count(aiCall) } }),
    /no key/,
  )
})

it('meters collect an existing credit reducer and compile its reference', () => {
  const purchase = event<{ amount: number }>('credits.purchased')
  const purchased = sum('purchased', purchase, 'amount')
  const credits = meter('credits', {
    reducer: sum('spent', aiCall, 'tokens'),
    creditReducer: purchased,
    price: { amount: 0 },
  })
  const config = defineConfig({ schema: { credits, purchased } })
  const ir = compile(config)
  assert.deepEqual(
    ir.reducers.map((r) => r.slug),
    ['purchased', 'spent'],
  )
  assert.deepEqual(
    ir.events.map((e) => e.name),
    ['ai_call', 'credits.purchased'],
  )
  assert.equal(ir.meters[0]?.credit_reducer, 'purchased')
  const defaultCredits = meter('credits', {
    reducer: credits.reducer,
    price: { amount: 0 },
  })
  assert.notEqual(
    checksum(ir),
    checksum(
      compile(
        defineConfig({
          schema: { credits: defaultCredits, purchased },
        }),
      ),
    ),
  )
  assert.throws(
    () =>
      meter('invalid', {
        reducer: credits.reducer,
        creditReducer: count('purchases', purchase),
        price: { amount: 0 },
      }),
    /named sum reducer/,
  )
})

it('defineConfig rejects two definitions with one key', () => {
  assert.throws(
    () =>
      defineConfig({
        schema: { a: count('calls', aiCall), b: count('calls', aiCall) },
      }),
    /defined twice/,
  )
})

it('compile emits server-shaped entries in a stable order', () => {
  const ir = compile(defineConfig({ schema }))
  assert.deepEqual(ir, {
    version: 4,
    events: [
      {
        name: 'ai_call',
      },
    ],
    reducers: [
      {
        slug: 'successful_calls',
        filter: {
          conjunction: 'and',
          clauses: [
            { property: 'name', operator: 'eq', value: 'ai_call' },
            { property: 'status', operator: 'eq', value: 'ok' },
            { property: 'tokens', operator: 'gt', value: 0 },
          ],
        },
        aggregation: { func: 'count' },
      },
      {
        slug: 'tokens',
        filter: {
          conjunction: 'and',
          clauses: [{ property: 'name', operator: 'eq', value: 'ai_call' }],
        },
        aggregation: { func: 'sum', property: 'tokens' },
      },
    ],
    meters: [
      {
        slug: 'tokens',
        reducer: 'tokens',
        unit_amount: 0.000002,
        currency: 'usd',
      },
    ],
    entitlements: [],
    products: [],
  })
})

it('products collect their meters and entitlements and compile sorted slugs', () => {
  const priority = entitlement('priority_models', { name: 'Priority models' })
  const sso = entitlement('sso')
  const calls = meter('calls', { reducer: count(aiCall), price: usd(0.001) })
  const pro = product('pro', {
    name: 'Pro',
    price: recurring({ interval: 'month', amount: usd(49) }),
    meters: [tokens, calls],
    entitlements: [sso, priority],
  })
  const config = defineConfig({ schema: { aiCall, pro } })
  assert.deepEqual(config.meters.map((m) => m.key).sort(), ['calls', 'tokens'])
  assert.deepEqual(config.entitlements.map((e) => e.key).sort(), [
    'priority_models',
    'sso',
  ])
  const ir = compile(config)
  assert.deepEqual(ir.entitlements, [
    { slug: 'priority_models', name: 'Priority models' },
    { slug: 'sso' },
  ])
  assert.deepEqual(ir.products, [
    {
      slug: 'pro',
      name: 'Pro',
      price: {
        type: 'recurring',
        interval: 'month',
        interval_count: 1,
        amount: 49,
        currency: 'usd',
      },
      meters: [
        { slug: 'calls', included: 0, limit: 'soft', rollover_cap: 0 },
        { slug: 'tokens', included: 0, limit: 'soft', rollover_cap: 0 },
      ],
      entitlements: ['priority_models', 'sso'],
    },
  ])
})

it('included and unlimited set a product meter terms', () => {
  const calls = meter('calls', { reducer: count(aiCall), price: usd(0.001) })
  const pro = product('pro', {
    name: 'Pro',
    price: recurring({ interval: 'month', amount: usd(49) }),
    meters: [
      included(tokens, 10_000, { limit: 'soft', rolloverCap: null }),
      unlimited(calls),
    ],
  })
  const ir = compile(defineConfig({ schema: { aiCall, pro } }))
  assert.deepEqual(ir.products[0].meters, [
    { slug: 'calls', included: 0, limit: 'unlimited', rollover_cap: 0 },
    { slug: 'tokens', included: 10_000, limit: 'soft', rollover_cap: null },
  ])
  // A bare meter and a wrapped one still collect the meter once.
  assert.deepEqual(
    compile(defineConfig({ schema: { aiCall, pro } })).meters.map(
      (m) => m.slug,
    ),
    ['calls', 'tokens'],
  )
  assert.equal(included(tokens, 500).limit, 'hard')
  assert.throws(() => included(tokens, -1), /non-negative amount/)
  // A term wins over a bare listing of the same meter, in either order, so a
  // plugin's whole table can be spread after the few meters with terms.
  const monthly = recurring({ interval: 'month', amount: usd(1) })
  const spread = product('spread', {
    name: 'Spread',
    price: monthly,
    meters: [tokens, included(tokens, 10), calls, calls],
  })
  assert.deepEqual(
    spread.meters.map((m) => [m.meter.key, m.included]),
    [
      ['tokens', 10],
      ['calls', 0],
    ],
  )
  assert.equal(
    product('spread2', {
      name: 'Spread',
      price: monthly,
      meters: [included(tokens, 10), tokens],
    }).meters[0]!.included,
    10,
  )
  assert.throws(
    () =>
      product('dup', {
        name: 'Dup',
        price: monthly,
        meters: [included(tokens, 10), unlimited(tokens)],
      }),
    /terms listed twice/,
  )
})

it('one-time products carry entitlements but reject meters', () => {
  const sso = entitlement('sso')
  const lifetime = product('lifetime', {
    name: 'Lifetime',
    price: oneTime({ amount: usd(299) }),
    entitlements: [sso],
  })
  assert.deepEqual(compile(defineConfig({ schema: { lifetime } })).products, [
    {
      slug: 'lifetime',
      name: 'Lifetime',
      price: { type: 'one_time', amount: 299, currency: 'usd' },
      meters: [],
      entitlements: ['sso'],
    },
  ])
  assert.throws(
    () =>
      product('bad', {
        name: 'Bad',
        price: oneTime({ amount: usd(1) }),
        meters: [tokens],
      }),
    /cannot carry meters/,
  )
})

it('products reject meters billed in another currency', () => {
  const kronor = meter('kronor', {
    reducer: count(aiCall),
    price: money('sek', 1),
  })
  assert.throws(
    () =>
      product('mixed', {
        name: 'Mixed',
        price: recurring({ interval: 'month', amount: usd(10) }),
        meters: [kronor],
      }),
    /bills in sek/,
  )
})

it('money helpers validate currency and amount', () => {
  assert.deepEqual(usd(0.5), { amount: 0.5, currency: 'usd' })
  assert.deepEqual(money('nok', 10), { amount: 10, currency: 'nok' })
  assert.throws(() => money('dollars', 1), /three-letter/)
  assert.throws(() => usd(-1), /non-negative/)
  assert.throws(
    () => recurring({ interval: 'month', intervalCount: 0, amount: usd(1) }),
    /positive integer/,
  )
})

it('checksum ignores export order and key order', () => {
  const a = checksum(
    compile(defineConfig({ schema: { aiCall, tokens, successfulCalls } })),
  )
  const b = checksum(
    compile(defineConfig({ schema: { successfulCalls, tokens, aiCall } })),
  )
  const c = checksum(
    compile(
      defineConfig({
        schema: {
          aiCall,
          tokens: meter('tokens', {
            reducer: sum(aiCall, 'tokens'),
            price: { amount: 0.000003, currency: 'usd' },
          }),
          successfulCalls,
        },
      }),
    ),
  )
  assert.equal(a, b)
  assert.notEqual(a, c)
})

it('inline reducers acquire meter keys without mutating their definitions', () => {
  const inline = sum(aiCall, 'tokens')
  const priced = meter('priced', { reducer: inline, price: { amount: 1 } })
  const unnamed: undefined = inline.key
  const named: 'priced' = priced.reducer.key
  assert.equal(unnamed, undefined)
  assert.equal(named, 'priced')
  const config = defineConfig({ schema: { aiCall, priced } })
  assert.equal(config.reducers[0]?.key, 'priced')
})

it('a meter preserves an explicitly named reducer shared by the config', () => {
  const usage = sum('usage', aiCall, 'tokens')
  const priced = meter('priced', { reducer: usage, price: { amount: 1 } })
  const key: 'usage' = priced.reducer.key
  assert.equal(key, 'usage')
  assert.equal(priced.reducer, usage)
  const config = defineConfig({ schema: { aiCall, usage, priced } })
  assert.equal(config.reducers.length, 1)
  assert.equal(compile(config).meters[0]?.reducer, 'usage')
})

it('metadata declarations are type-only and do not enter the deploy checksum', () => {
  const before = event<{ amount: number }>('purchase')
  const after = event<{ amount: number; note?: string }>('purchase')
  assert.deepEqual(before, { kind: 'event', name: 'purchase' })
  assert.equal(
    checksum(compile(defineConfig({ schema: { purchase: before } }))),
    checksum(compile(defineConfig({ schema: { purchase: after } }))),
  )
})

it('signals compile into the IR and change the checksum', () => {
  const lowBalance = signal('low-balance', {
    meter: tokens,
    field: 'remaining',
    enter: { below: 100 },
    exit: { atLeast: 500 },
  })
  const abuse = signal('abuse', {
    meter: tokens,
    when: 'Is this identity abusing the service?',
    enter: { above: 0.8 },
    exit: { below: 0.4 },
  })
  const base = compile(defineConfig({ schema }))
  assert.equal(base.signals, undefined)
  const ir = compile(defineConfig({ schema: { ...schema, lowBalance, abuse } }))
  assert.deepEqual(ir.signals, [
    {
      slug: 'abuse',
      kind: 'semantic',
      meter: 'tokens',
      when: 'Is this identity abusing the service?',
      over: { amount: 1, unit: 'hour' },
      enter_above: 0.8,
      exit_below: 0.4,
    },
    {
      slug: 'low-balance',
      kind: 'meter',
      meter: 'tokens',
      enter_below: 100,
      exit_at_least: 500,
    },
  ])
  assert.notEqual(checksum(base), checksum(ir))
})

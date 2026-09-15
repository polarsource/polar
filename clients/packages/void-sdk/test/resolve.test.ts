import { assert, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import { Api, type Meter, type Product, type Reducer } from '../src/api/index'
import { VoidError } from '../src/errors'
import { Resolver, ResolverLive } from '../src/runtime/resolve'

const reducer: Reducer = {
  id: 'r1',
  slug: 'tokens',
  created_at: 't',
  type: 'scalar',
  filter: { conjunction: 'and', clauses: [] },
  aggregation: { func: 'count' },
  map: null,
}
const meter: Meter = {
  variant_id: null,
  branch_id: null,
  id: 'm1',
  name: 'Token usage',
  slug: 'tokens',
  generation_id: 1,
  usage_reducer_id: 'r1',
  credit_reducer_id: 'credits',
  unit_amount: '1',
  currency: 'usd',
  created_at: 't',
}
let reducerCalls = 0
let meterCalls = 0
let meters: ReadonlyArray<Meter> = [meter]
const product: Product = {
  variant_id: null,
  meter_terms: {},
  id: 'p1',
  slug: 'pro',
  generation_id: 2,
  name: 'Pro',
  description: null,
  price: { type: 'one_time', amount: '49', currency: 'usd' },
  meters: [],
  entitlements: [],
  archived_at: null,
  created_at: 't',
}
let defaultVariantId: string | null = null
const api = Layer.mock(Api, {
  organizationsCurrent: () =>
    Effect.sync(() => ({
      id: 'org',
      name: 'Org',
      slug: 'org',
      created_at: 't',
      default_variant_id: defaultVariantId,
    })),
  productsList: () =>
    Effect.succeed([
      product,
      {
        ...product,
        id: 'candidate',
        variant_id: 'candidate',
        generation_id: 99,
      },
      {
        ...product,
        id: 'archived',
        variant_id: 'candidate',
        generation_id: 100,
        archived_at: 't',
      },
    ]),
  reducersList: () =>
    Effect.suspend(() => {
      reducerCalls++
      return reducerCalls === 1
        ? Effect.fail(
            new VoidError({
              reason: 'unreachable',
              message: 'temporary failure',
            }),
          )
        : Effect.succeed([reducer])
    }),
  metersList: () =>
    Effect.suspend(() => {
      meterCalls++
      return meterCalls === 1
        ? Effect.fail(
            new VoidError({
              reason: 'unreachable',
              message: 'temporary failure',
            }),
          )
        : Effect.succeed(meters)
    }),
})

layer(ResolverLive.pipe(Layer.provide(api)))((it) => {
  it.effect(
    'retries failed listings, shares successful listings, refreshes and resets',
    () =>
      Effect.gen(function* () {
        const resolver = yield* Resolver
        assert.equal((yield* resolver.productBySlug('pro')).id, 'p1')
        assert.equal(
          (yield* resolver.productBySlug('pro', 'candidate')).id,
          'candidate',
        )
        assert.equal(
          (yield* Effect.flip(resolver.reducerBySlug('tokens')))._tag,
          'VoidError',
        )
        assert.equal(
          (yield* Effect.flip(resolver.meterBySlug('tokens')))._tag,
          'VoidError',
        )
        yield* Effect.all(
          [
            resolver.reducerBySlug('tokens'),
            resolver.reducerBySlug('tokens'),
            resolver.meterBySlug('tokens'),
            resolver.meterBySlug('tokens'),
          ],
          { concurrency: 'unbounded' },
        )
        assert.equal(reducerCalls, 2)
        assert.equal(meterCalls, 2)

        meters = [
          meter,
          { ...meter, id: 'm2', name: 'Renamed tokens', generation_id: 2 },
          {
            ...meter,
            id: 'other',
            slug: 'other',
            name: 'tokens',
            generation_id: 99,
          },
          { ...meter, id: 'branch', generation_id: 3, branch_id: 'preview' },
          {
            ...meter,
            id: 'variant',
            generation_id: 99,
            variant_id: 'candidate',
          },
        ]
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'm1')
        yield* TestClock.adjust('61 seconds')
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'm2')
        assert.equal(
          (yield* resolver.meterBySlug('tokens', 'candidate')).id,
          'variant',
        )
        yield* resolver.reducerBySlug('tokens')
        assert.equal(reducerCalls, 3)
        assert.equal(meterCalls, 3)

        yield* resolver.reset
        yield* resolver.reducerBySlug('tokens')
        yield* resolver.meterBySlug('tokens')
        assert.equal(reducerCalls, 4)
        assert.equal(meterCalls, 4)
        defaultVariantId = 'candidate'
        assert.equal((yield* resolver.productBySlug('pro')).id, 'candidate')
        assert.equal((yield* resolver.meterBySlug('tokens')).id, 'variant')
        assert.equal((yield* resolver.productBySlug('pro', null)).id, 'p1')
        assert.equal((yield* resolver.meterBySlug('tokens', null)).id, 'm2')
        defaultVariantId = 'missing'
        assert.equal(
          (yield* Effect.flip(resolver.productBySlug('pro')))._tag,
          'VoidError',
        )
        assert.equal(
          (yield* resolver.productBySlug('pro', 'candidate')).id,
          'candidate',
        )
        defaultVariantId = null
        assert.equal((yield* resolver.productBySlug('pro')).id, 'p1')
      }),
  )
})

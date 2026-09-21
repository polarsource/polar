import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import {
  Api,
  type Event as WireEvent,
  type IdentityEntitlements,
  type Product as WireProduct,
  type ProductSubscription as Subscription,
  type SubscriptionCycle,
} from '../api/index'
import type { TimeInterval } from '../api/generated'
import type { RunEffect } from '../api/layers'
import type { Config, SchemaModule } from '../config/config'
import type { PluginDef, VerbsOf } from '../config/plugin'
import type { Limit } from '../config/schema'
import {
  isDefinition,
  type EntitlementDef,
  type EventDef,
  type MetadataOf,
  type MeterDef,
  type OneTimePrice,
  type ProductDef,
  type RecurringPrice,
  type ReducerDef,
  type AnyReducer,
  type DerivedReducer,
  type ScalarReducer,
  type RecordReducer,
  type Metadata,
} from '../config/schema'
import { VoidError } from '../errors'
import { Resolver } from './resolve'
import type { Background } from './background'
import {
  balanceLocally,
  balancesLocally,
  checkLocally,
} from '../storage/reconcile'
import type { SignalRef } from '../config/schema'
import type { SignalQuery } from './signals'

export interface EventsOptions {
  /** Maximum matching events, from 1 to 1000. Defaults to 100. */
  readonly limit?: number
}
export type RecordedEvent<E extends EventDef> = Omit<WireEvent, 'metadata'> & {
  readonly metadata: MetadataOf<E>
}
export type RecordData<R extends RecordReducer> = MetadataOf<
  R['filter']['event']
>

export interface RecordOptions {
  /** Idempotency key. A random uuid unless given. */
  readonly id?: string
  readonly timestamp?: Date
}
export interface CheckResult {
  readonly allowed: boolean
  /** What the tightest capped holder has left; null when every holder is unlimited. */
  readonly remaining: number | null
  /** The tightest holder's usage past its credits, billed at the meter's price. */
  readonly overage: number
  /** The tightest holder's policy; null when nothing up the chain holds credits or a subscription. */
  readonly limit: Limit | null
  /** The tightest holder, or the one denying when not allowed; null without a holder. */
  readonly limitedBy: string | null
  /** no_plan means no credit/subscription holder; cap means a hard holder cannot cover the estimate. */
  readonly reason: 'ok' | 'cap' | 'no_plan' | 'access_denied' | 'missing_period'
  /** The tightest holder's current period, when its subscription cycles. */
  readonly period: { readonly start: Date; readonly end: Date } | null
  /** Present when local storage was checked; applied means unprocessed local events contributed. */
  readonly reconciliation?: {
    readonly applied: boolean
    readonly eventCount: number
    readonly remoteRemaining: number
    /** Difference between reconciled and remote availability, including holder limits. */
    readonly localAdjustment: number
  }
}
/**
 * Where an identity stands on a meter. `usage` and `credits` are its own:
 * what its subtree spent and what it holds. `remaining` and the fields after
 * it come from the chain, the way `check` sees it, so a member that holds
 * nothing still learns what its cap and the root's pool leave it.
 */
export interface BalanceResult {
  /** What this identity and everything under it spent this period. */
  readonly usage: number
  /** Credits this identity itself holds this period; 0 below the holder. */
  readonly credits: number
  /** What the tightest holder or cap up the chain has left; null when nothing limits it. */
  readonly remaining: number | null
  /** The tightest holder's usage past its credits. */
  readonly overage: number
  /** The tightest holder's policy; null when nothing up the chain holds credits or a subscription. */
  readonly limit: Limit | null
  /** Who sets `remaining`: this identity or an ancestor; null without a holder. */
  readonly limitedBy: string | null
  /** Why `remaining` is 0 when the numbers alone do not say. */
  readonly reason: 'ok' | 'no_plan' | 'access_denied' | 'missing_period'
  /** The tightest holder's current period, when its subscription cycles. */
  readonly period: CheckResult['period']
  readonly reconciliation?: CheckResult['reconciliation']
}
export interface BalanceOptions {
  /** Historical balances are remote-only. */
  readonly at?: Date
  /** Defaults to true for current balances when local event storage is configured. */
  readonly reconcile?: boolean
}
export interface UsageRange {
  readonly start?: Date
  readonly end?: Date
  readonly interval?: TimeInterval
  readonly groupBy?: 'identity' | 'root'
}
export interface UsageSeries<Value = number> {
  readonly identity: string | null
  readonly root: string | null
  readonly total: Value
  readonly periods: ReadonlyArray<{
    readonly timestamp: string
    readonly value: Value
  }>
}
export interface EventQuery<E extends EventDef> {
  record(metadata: MetadataOf<E>, options?: RecordOptions): Promise<void>
  list(options?: EventsOptions): Promise<ReadonlyArray<RecordedEvent<E>>>
}
export interface ScalarQuery<Value = number> {
  total(): Promise<Value>
  usage(range?: UsageRange): Promise<ReadonlyArray<UsageSeries<Value>>>
}
export interface RecordQuery<R extends RecordReducer> {
  latest(): Promise<{
    readonly timestamp: string
    readonly data: MetadataOf<R['filter']['event']>
  } | null>
}
export interface MeterQuery extends ScalarQuery {
  check(options: { readonly estimate: number }): Promise<CheckResult>
  balance(options?: Date | BalanceOptions): Promise<BalanceResult>
  /**
   * Current balances for several identities of this identity's tree, keyed
   * by external id. With local event storage this loads the tree's snapshot
   * once and folds each identity from it, instead of one load per identity;
   * identities outside the tree are left out. Without storage it reads each
   * balance remotely.
   */
  balances(ids: readonly string[]): Promise<ReadonlyMap<string, BalanceResult>>
}
export interface SubscribeOptions {
  /** Anchor for every boundary. Defaults to now; the past is allowed, the future is not. */
  readonly startsAt?: Date
}
export interface CancelOptions {
  /** Keep access until the next boundary. Defaults to true. */
  readonly atPeriodEnd?: boolean
}
export interface RecurringProductQuery {
  /** The current generation as deployed. */
  get(): Promise<WireProduct>
  /** Subscribe this identity; the server writes the row and the derived meter events. */
  subscribe(options?: SubscribeOptions): Promise<Subscription>
}
export interface OneTimeProductQuery {
  get(): Promise<WireProduct>
  /** Record a purchase; its entitlements are held from now on. */
  purchase(): Promise<Subscription>
}
export interface EntitlementQuery {
  /** Held by this identity or any ancestor through an active subscription. */
  has(): Promise<boolean>
}
export interface SubscriptionsQuery {
  list(options?: {
    readonly active?: boolean
  }): Promise<ReadonlyArray<Subscription>>
  cancel(id: string, options?: CancelOptions): Promise<Subscription>
  /** End access immediately. */
  revoke(id: string): Promise<Subscription>
  /** Closed periods priced at read time: fixed amount plus metered usage. */
  cycles(id: string): Promise<ReadonlyArray<SubscriptionCycle>>
  /** Every entitlement held, with the subscription up the chain granting it. */
  entitlements(): Promise<IdentityEntitlements>
}
/** Each plugin's verbs, under the plugin's export name, beside the queries. */
export type PluginVerbs<M extends SchemaModule> = {
  readonly [K in keyof M as M[K] extends PluginDef
    ? K
    : never]: M[K] extends PluginDef ? VerbsOf<M[K]> : never
}

export type Queries<M extends SchemaModule> = BaseQueries<M> & PluginVerbs<M>

export interface BaseQueries<M extends SchemaModule> {
  readonly signals: {
    readonly [K in keyof M as M[K] extends SignalRef ? K : never]: SignalQuery
  }
  readonly events: {
    readonly [K in keyof M as M[K] extends EventDef ? K : never]: EventQuery<
      Extract<M[K], EventDef>
    >
  }
  readonly reducers: {
    readonly [K in keyof M as M[K] extends
      | ScalarReducer
      | RecordReducer
      | DerivedReducer
      ? K
      : never]: M[K] extends RecordReducer
      ? RecordQuery<M[K]>
      : M[K] extends DerivedReducer
        ? ScalarQuery<number | null>
        : ScalarQuery
  }
  readonly meters: {
    readonly [K in keyof M as M[K] extends MeterDef ? K : never]: MeterQuery
  }
  readonly products: {
    readonly [K in keyof M as M[K] extends ProductDef
      ? K
      : never]: M[K] extends ProductDef<string, RecurringPrice>
      ? RecurringProductQuery
      : M[K] extends ProductDef<string, OneTimePrice>
        ? OneTimeProductQuery
        : RecurringProductQuery & OneTimeProductQuery
  }
  readonly entitlements: {
    readonly [K in keyof M as M[K] extends EntitlementDef
      ? K
      : never]: EntitlementQuery
  }
  readonly subscriptions: SubscriptionsQuery
}

const EPOCH = '2000-01-01T00:00:00.000Z'
const DAY = 86_400_000

/** The API validates the wire envelope. Custom metadata types are caller declarations. */
function declaredMetadata<M extends Metadata>(value: Record<string, unknown>): M
function declaredMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return value
}

const isNamedReducer = (
  definition: ReducerDef<string | undefined> | DerivedReducer,
): definition is ScalarReducer | RecordReducer | DerivedReducer =>
  definition.key !== undefined

const isRecordReducer = (definition: AnyReducer): definition is RecordReducer =>
  definition.aggregation.func === 'first' ||
  definition.aggregation.func === 'last'

/** Bind schema definitions to typed Promise queries for an identity. */
export function makeQueries<M extends SchemaModule>(
  config: Config<M>,
  run: RunEffect<Api | Resolver | Background>,
  signalQuery: (customerId: string, ref: SignalRef) => SignalQuery,
): (id: string) => Queries<M> {
  const meterId = Effect.fn(function* (def: MeterDef) {
    const resolver = yield* Resolver
    return (yield* resolver.meterBySlug(def.key, config.versionId)).id
  })
  const reducerId = Effect.fn(function* (def: AnyReducer) {
    const resolver = yield* Resolver
    return (yield* resolver.reducerBySlug(def.key)).id
  })
  const productOf = Effect.fn(function* (def: ProductDef) {
    const resolver = yield* Resolver
    return yield* resolver.productBySlug(def.key, config.versionId)
  })

  const ingest = Effect.fn('Scope.ingest')(function* (
    id: string,
    name: string,
    metadata: Metadata,
    options: RecordOptions = {},
  ) {
    const api = yield* Api
    yield* api.eventsIngest({
      payload: [
        {
          name,
          external_id: options.id ?? randomUUID(),
          external_identity_id: id,
          metadata,
          ...(options.timestamp && {
            timestamp: options.timestamp.toISOString(),
          }),
        },
      ],
    })
  })

  type Untyped = {
    signals: Record<string, SignalQuery>
    events: Record<string, EventQuery<EventDef>>
    reducers: Record<
      string,
      ScalarQuery<number | null> | RecordQuery<RecordReducer>
    >
    meters: Record<string, MeterQuery>
    products: Record<string, RecurringProductQuery | OneTimeProductQuery>
    entitlements: Record<string, EntitlementQuery>
    subscriptions: SubscriptionsQuery
  } & Record<string, unknown>

  // The schema walk below mirrors Queries<M>; metadata remains caller-declared.
  // A plugin's verbs are built over the same walk of its own schema.
  function queries(id: string): Queries<M>
  function queries(id: string): Untyped {
    return walk(config.schema, id)
  }

  function walk(schema: SchemaModule, id: string): Untyped {
    const subscribe = Effect.fn('Scope.subscribe')(function* (
      ref: ProductDef,
      { startsAt }: SubscribeOptions = {},
    ) {
      const api = yield* Api
      const product = yield* productOf(ref)
      return yield* api.subscriptionsCreate({
        payload: {
          product_id: product.id,
          external_identity_id: id,
          ...(startsAt && { starts_at: startsAt.toISOString() }),
        },
      })
    })

    const listSubscriptions = Effect.fn('Scope.subscriptions')(function* ({
      active = false,
    }: { readonly active?: boolean } = {}) {
      const api = yield* Api
      return yield* api.subscriptionsList({
        params: { external_identity_id: id, active },
      })
    })

    const cancel = Effect.fn('Scope.cancel')(function* (
      subscriptionId: string,
      { atPeriodEnd = true }: CancelOptions = {},
    ) {
      const api = yield* Api
      return yield* api.subscriptionsCancel(subscriptionId, {
        payload: { at_period_end: atPeriodEnd },
      })
    })

    const entitlements = Effect.fn('Scope.entitlements')(function* () {
      const api = yield* Api
      return yield* api.identitiesEntitlements(id, undefined)
    })

    const has = Effect.fn('Scope.has')(function* (ref: EntitlementDef) {
      const held = yield* entitlements()
      return held.slugs.includes(ref.key)
    })

    const listEvents = Effect.fn('Scope.events')(function* <E extends EventDef>(
      ref: E,
      { limit = 100 }: EventsOptions = {},
    ) {
      const api = yield* Api
      const { items } = yield* api.eventsList({
        params: { external_identity_id: id, name: ref.name, limit },
      })
      return items.map((item) => ({
        ...item,
        metadata: declaredMetadata<MetadataOf<E>>(item.metadata),
      }))
    })

    const check = Effect.fn('Scope.check')(function* (
      ref: MeterDef,
      { estimate }: { estimate: number },
    ) {
      if (!(estimate > 0)) {
        return yield* new VoidError({
          reason: 'invalid_argument',
          message: 'check: estimate must be greater than zero',
        })
      }
      if (config.eventStorage.length > 0) {
        return yield* checkLocally(config, ref, id, estimate)
      }
      const api = yield* Api
      const result = yield* api.metersCheck(yield* meterId(ref), {
        params: { external_identity_id: id, size: estimate },
      })
      const reason: CheckResult['reason'] =
        result.reason === 'no_holder'
          ? 'no_plan'
          : result.reason === 'exhausted'
            ? 'cap'
            : (result.reason ?? 'ok')
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        overage: result.overage ?? 0,
        limit: result.limit ?? null,
        limitedBy: result.external_identity_id,
        reason,
        period:
          result.period_start && result.period_end
            ? {
                start: new Date(result.period_start),
                end: new Date(result.period_end),
              }
            : null,
      } satisfies CheckResult
    })

    const remoteBalance = Effect.fn('Scope.remoteBalance')(function* (
      ref: MeterDef,
      target: string,
      at?: Date,
    ) {
      const api = yield* Api
      const result = yield* api.metersBalance(yield* meterId(ref), {
        params: {
          external_identity_id: target,
          ...(at && { at: at.toISOString() }),
        },
      })
      return {
        usage: result.usage ?? 0,
        credits: result.credits ?? 0,
        remaining: result.remaining,
        overage: result.overage ?? 0,
        limit: result.limit ?? null,
        limitedBy: result.limited_by ?? null,
        reason:
          result.reason === 'no_holder'
            ? 'no_plan'
            : result.reason === 'exhausted' || result.reason === undefined
              ? 'ok'
              : result.reason,
        period:
          result.period_start && result.period_end
            ? {
                start: new Date(result.period_start),
                end: new Date(result.period_end),
              }
            : null,
      } satisfies BalanceResult
    })

    const balance = Effect.fn('Scope.balance')(function* (
      ref: MeterDef,
      options: Date | BalanceOptions = {},
    ) {
      const { at, reconcile } =
        options instanceof Date ? { at: options } : options
      if (at && reconcile === true) {
        return yield* new VoidError({
          reason: 'invalid_argument',
          message: 'balance: historical balances cannot reconcile local events',
        })
      }
      if (!at && reconcile !== false && config.eventStorage.length > 0) {
        return yield* balanceLocally(config, ref, id)
      }
      return yield* remoteBalance(ref, id, at)
    })

    const balances = Effect.fn('Scope.balances')(function* (
      ref: MeterDef,
      ids: readonly string[],
    ) {
      if (config.eventStorage.length > 0) {
        return yield* balancesLocally(config, ref, id, ids)
      }
      const results = yield* Effect.all(
        ids.map((each) => remoteBalance(ref, each)),
        { concurrency: 'unbounded' },
      )
      return new Map(ids.map((each, i) => [each, results[i]!] as const))
    })

    const usage = Effect.fn('Scope.usage')(function* (
      ref: ScalarReducer | DerivedReducer,
      range: UsageRange = {},
    ) {
      const api = yield* Api
      const { series } = yield* api.metricsGet({
        params: {
          reducer_id: yield* reducerId(ref),
          start: (range.start ?? new Date(EPOCH)).toISOString(),
          end: (range.end ?? new Date(Date.now() + DAY)).toISOString(),
          interval: range.interval ?? 'year',
          external_identity_id: id,
          ...(range.groupBy && {
            group_by:
              range.groupBy === 'root'
                ? 'external_root_id'
                : 'external_identity_id',
          }),
        },
      })
      return series.map((s) => ({
        identity: s.external_identity_id,
        root: s.external_root_id,
        total: s.total,
        periods: s.periods,
      }))
    })

    const latest = Effect.fn('Scope.latest')(function* <
      R extends RecordReducer,
    >(ref: R) {
      const api = yield* Api
      const reducer = yield* reducerId(ref)
      const [record] = yield* api.reducersRecords(reducer, {
        params: { external_identity_id: id },
      })
      if (!record) return null
      return {
        timestamp: record.timestamp,
        data: declaredMetadata<RecordData<R>>(record.data),
      }
    })

    const signalQueries: Array<[string, SignalQuery]> = []
    const eventQueries: Array<[string, EventQuery<EventDef>]> = []
    const reducerQueries: Array<
      [string, ScalarQuery<number | null> | RecordQuery<RecordReducer>]
    > = []
    const meterQueries: Array<[string, MeterQuery]> = []
    const productQueries: Array<
      [string, RecurringProductQuery | OneTimeProductQuery]
    > = []
    const entitlementQueries: Array<[string, EntitlementQuery]> = []
    const verbs: Array<[string, unknown]> = []
    const scalar = (reducer: ScalarReducer): ScalarQuery => ({
      total: () =>
        run(Effect.map(usage(reducer), (series) => series[0]?.total ?? 0)),
      usage: (range) =>
        run(
          Effect.map(usage(reducer, range), (series) =>
            series.map((s) => ({
              ...s,
              total: s.total ?? 0,
              periods: s.periods.map((p) => ({ ...p, value: p.value ?? 0 })),
            })),
          ),
        ),
    })
    const derived = (reducer: DerivedReducer): ScalarQuery<number | null> => ({
      total: () =>
        run(Effect.map(usage(reducer), (series) => series[0]?.total ?? null)),
      usage: (range) => run(usage(reducer, range)),
    })
    for (const [name, definition] of Object.entries(schema)) {
      if (!isDefinition(definition)) continue
      switch (definition.kind) {
        case 'event':
          eventQueries.push([
            name,
            {
              record: (metadata, options) =>
                run(ingest(id, definition.name, metadata, options)),
              list: (options) => run(listEvents(definition, options)),
            },
          ])
          break
        case 'signal':
          signalQueries.push([name, signalQuery(id, definition)])
          break
        case 'reducer': {
          if (!isNamedReducer(definition)) continue
          const query = isRecordReducer(definition)
            ? { latest: () => run(latest(definition)) }
            : 'inputs' in definition
              ? derived(definition)
              : scalar(definition)
          reducerQueries.push([name, query])
          break
        }
        case 'meter':
          meterQueries.push([
            name,
            {
              ...scalar(definition.reducer),
              check: (options) => run(check(definition, options)),
              balance: (at) => run(balance(definition, at)),
              balances: (ids) => run(balances(definition, ids)),
            },
          ])
          break
        case 'product':
          productQueries.push([
            name,
            definition.price.type === 'recurring'
              ? {
                  get: () => run(productOf(definition)),
                  subscribe: (options) => run(subscribe(definition, options)),
                }
              : {
                  get: () => run(productOf(definition)),
                  purchase: () => run(subscribe(definition)),
                },
          ])
          break
        case 'entitlement':
          entitlementQueries.push([name, { has: () => run(has(definition)) }])
          break
        case 'plugin':
          verbs.push([
            name,
            definition.runtime(walk(definition.schema, id), { id }),
          ])
      }
    }
    return {
      ...Object.fromEntries(verbs),
      signals: Object.fromEntries(signalQueries),
      events: Object.fromEntries(eventQueries),
      reducers: Object.fromEntries(reducerQueries),
      meters: Object.fromEntries(meterQueries),
      products: Object.fromEntries(productQueries),
      entitlements: Object.fromEntries(entitlementQueries),
      subscriptions: {
        list: (options) => run(listSubscriptions(options)),
        cancel: (subscriptionId, options) =>
          run(cancel(subscriptionId, options)),
        revoke: (subscriptionId) =>
          run(
            Effect.flatMap(Api, (api) =>
              api.subscriptionsRevoke(subscriptionId, undefined),
            ),
          ),
        cycles: (subscriptionId) =>
          run(
            Effect.flatMap(Api, (api) =>
              api.subscriptionsCycles(subscriptionId, undefined),
            ),
          ),
        entitlements: () => run(entitlements()),
      },
    }
  }

  return queries
}

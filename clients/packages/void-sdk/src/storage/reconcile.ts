import { isDeepStrictEqual } from 'node:util'
import { Effect } from 'effect'
import { Api } from '../api/index'
import type {
  CustomerState,
  ReducerState,
  MeterHolderState,
} from '../api/generated'
import { compile } from '../config/compile'
import type { Config } from '../config/config'
import type { Limit, MeterDef } from '../config/schema'
import { VoidError } from '../errors'
import { Background } from '../runtime/background'
import type { BalanceResult, CheckResult } from '../runtime/queries'
import type { StoredEvent } from './storage'
import { contribution, matches, merge } from './reducers'
import { fold, nextBoundary, resume } from './balance'
import { eventIncluded } from './events'

const fail = (message: string): never => {
  throw new VoidError({ reason: 'reconciliation', message: `void: ${message}` })
}
const bucketKey = (r: string, actor: string | null, at: number) =>
  JSON.stringify([r, actor, at])
const bucketTime = (at: string) => Math.floor(Date.parse(at) / 300000) * 300000
const comparable = (value: unknown): unknown => {
  if (Array.isArray(value))
    return value
      .map(comparable)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === 'property' && typeof v === 'string'
          ? v.replace(/^metadata\./, '')
          : comparable(v),
      ]),
    )
  return value
}

/** Pure snapshot + local event merge. Inclusion receipts, not wall-clock time, decide overlap. */
export function reconcile(
  config: Config,
  ref: MeterDef,
  snapshot: CustomerState,
  id: string,
  events: readonly StoredEvent[],
  now: Date,
): LocalCheck
export function reconcile(
  config: Config,
  ref: MeterDef,
  snapshot: CustomerState,
  id: string,
  events: readonly StoredEvent[],
  now: Date,
  mode: 'balance',
): BalanceResult
export function reconcile(
  config: Config,
  ref: MeterDef,
  snapshot: CustomerState,
  id: string,
  events: readonly StoredEvent[],
  now: Date,
  mode: 'check' | 'balance' = 'check',
): LocalCheck | BalanceResult {
  const deployed = snapshot.meters.find(
    (m) =>
      m.meter.slug === ref.key &&
      (config.versionId === undefined ||
        m.meter.version_id === config.versionId),
  )
  if (!deployed)
    return fail(`meter ${ref.key} is not deployed; run \`void deploy\``)
  const deployedMeter = deployed.meter
  const ir = compile(config)
  const usage =
    snapshot.reducers.find((r) => r.id === deployed.meter.usage_reducer_id) ??
    fail('customer state is missing the usage reducer')
  const credit =
    snapshot.reducers.find((r) => r.id === deployed.meter.credit_reducer_id) ??
    fail('customer state is missing the credit reducer')
  if (!usage || !credit) return fail('customer state is missing meter reducers')
  if (
    usage.aggregation.func === 'derive' ||
    credit.aggregation.func === 'derive'
  )
    return fail('Derived reducers are available for metrics only')
  const expectedUsage = ir.reducers.find((r) => r.slug === ref.reducer.key)!
  const expectedCredit = ref.creditReducer
    ? ir.reducers.find((r) => r.slug === ref.creditReducer!.key)!
    : {
        slug: `${ref.reducer.key}-credits`,
        filter: {
          conjunction: 'and',
          clauses: [
            { property: 'name', operator: 'eq', value: 'credit.granted' },
            { property: 'meter', operator: 'eq', value: ref.key },
          ],
        },
        aggregation: { func: 'sum', property: 'amount' },
        map: undefined,
      }
  for (const [actual, expected] of [
    [usage, expectedUsage],
    [credit, expectedCredit],
  ] as const) {
    if (
      actual.slug !== expected.slug ||
      !isDeepStrictEqual(actual.map ?? null, expected.map ?? null) ||
      !isDeepStrictEqual(
        comparable(actual.filter),
        comparable(expected.filter),
      ) ||
      !isDeepStrictEqual(
        comparable(actual.aggregation),
        comparable(expected.aggregation),
      )
    ) {
      return fail(
        `meter ${ref.key} differs from local config; run \`void deploy\``,
      )
    }
  }
  const parents = new Map(
    snapshot.identities.map((i) => [i.external_id, i.parent_external_id]),
  )
  if (!parents.has(id))
    return fail(`identity ${id} is missing from customer state`)
  const belongs = (actor: string | null, holder: string): boolean => {
    const visited = new Set<string>()
    while (actor !== null) {
      if (visited.has(actor))
        return fail('customer state contains an identity cycle')
      visited.add(actor)
      if (actor === holder) return true
      actor = parents.get(actor) ?? null
    }
    return false
  }
  const selected = snapshot.buckets.filter(
    (b) => b.reducer_id === usage.id || b.reducer_id === credit.id,
  )
  const buckets = new Map<string, ReducerState>(
    selected.map((b) => [
      bucketKey(
        b.reducer_id,
        b.external_identity_id,
        Date.parse(b.bucket_start),
      ),
      b,
    ]),
  )
  const applied = new Set<string>()
  const seen = new Set<string>()
  for (const event of events) {
    if (
      event.organization_id !== snapshot.organization_id ||
      !parents.has(event.external_identity_id ?? '') ||
      Date.parse(event.timestamp) > now.getTime()
    )
      continue
    if (seen.has(event.external_id)) continue
    seen.add(event.external_id)
    for (const reducer of [usage, credit]) {
      if (!matches(reducer.filter, event, snapshot.customer.external_id))
        continue
      const value = contribution(reducer, event)
      if (value === null) continue
      const time = bucketTime(event.timestamp),
        key = bucketKey(reducer.id, event.external_identity_id, time)
      const remote = buckets.get(key)
      if (remote && remote.last_processed_event === null)
        return fail(
          'reducer result has no last_processed_event metadata; recompute existing reducer buckets before reconciling',
        )
      if (remote?.last_processed_event?.event_ids.includes(event.external_id))
        continue
      // An event counts when it moves what this identity may spend: credits
      // held anywhere up the chain, usage under any holder the identity is under.
      if (
        reducer.id === credit.id
          ? belongs(id, event.external_identity_id!)
          : deployed.holders.some(
              (h) =>
                belongs(id, h.external_identity_id) &&
                belongs(event.external_identity_id, h.external_identity_id),
            )
      )
        applied.add(event.external_id)
      const lastProcessedEvent = remote?.last_processed_event ?? {
        external_id: event.external_id,
        timestamp: event.timestamp,
        ingested_at: event.recorded_at,
        event_ids: [],
      }
      buckets.set(key, {
        reducer_id: reducer.id,
        external_identity_id: event.external_identity_id,
        bucket_start: new Date(time).toISOString(),
        value:
          remote?.value == null
            ? value
            : merge(reducer.aggregation.func, [remote.value, value]),
        last_processed_event: {
          ...lastProcessedEvent,
          event_ids: [...lastProcessedEvent.event_ids, event.external_id],
        },
      })
    }
  }
  function balance(holder: MeterHolderState) {
    const lifecycle = [...holder.events]
    const remoteIds = new Set(lifecycle.map((e) => e.id))
    for (const event of events) {
      if (
        event.organization_id !== snapshot.organization_id ||
        event.external_identity_id !== holder.external_identity_id ||
        event.metadata.meter_id !== deployedMeter.id ||
        !event.name.startsWith('subscription.') ||
        remoteIds.has(event.external_id) ||
        Date.parse(event.timestamp) > now.getTime()
      )
        continue
      applied.add(event.external_id)
      lifecycle.push({
        id: event.external_id,
        at: event.timestamp,
        name: event.name,
        data: event.metadata,
      })
      remoteIds.add(event.external_id)
    }
    lifecycle.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const until = now.getTime()
    const initial = resume(holder.base)
    const start = holder.base.at ? Date.parse(holder.base.at) : 0
    const boundaries = fold(initial, lifecycle, [], [], until).boundaries
    const edges = [
      ...new Set([
        start,
        ...lifecycle.map((e) => Date.parse(e.at)),
        ...boundaries,
      ]),
    ].sort((a, b) => a - b)
    const values = (reducer: typeof usage) => {
      const grouped = new Map<number, number[]>()
      const baseline =
        reducer.id === credit.id ? holder.credit_base : holder.usage_base
      if (baseline != null) grouped.set(start, [baseline])
      for (const bucket of buckets.values()) {
        const at = Date.parse(bucket.bucket_start)
        if (
          bucket.reducer_id !== reducer.id ||
          at < Date.parse(snapshot.since) ||
          at >= until ||
          bucket.value === null
        )
          continue
        const included =
          reducer.id === credit.id
            ? bucket.external_identity_id === holder.external_identity_id
            : belongs(bucket.external_identity_id, holder.external_identity_id)
        if (!included) continue
        let edge = start
        for (const candidate of edges) {
          if (candidate > at) break
          edge = candidate
        }
        grouped.set(edge, [...(grouped.get(edge) ?? []), bucket.value])
      }
      return [...grouped]
        .sort(([a], [b]) => a - b)
        .map(([at, values]): [number, number] => [
          at,
          merge(reducer.aggregation.func, values),
        ])
    }
    const credits = values(credit),
      usages = values(usage)
    const state = fold(initial, lifecycle, credits, usages, until)
    return {
      state,
      isHolder:
        holder.is_holder ||
        credits.length > 0 ||
        lifecycle.length > 0 ||
        state.subscription !== null,
    }
  }
  /** A balance is the chain's position plus this identity's own ledger. */
  const done = (position: LocalCheck): LocalCheck | BalanceResult => {
    if (mode !== 'balance') return position
    const own = deployed.holders.find((h) => h.external_identity_id === id)
    if (!own) return fail(`customer state is missing the balance for ${id}`)
    const { state } = balance(own)
    return {
      usage: state.usage,
      credits: state.credits,
      remaining: position.remaining,
      overage: position.overage,
      limit: position.limit,
      limitedBy: position.limitedBy,
      // No estimate was applied, so the numbers never say `cap`.
      reason: position.reason === 'cap' ? 'ok' : position.reason,
      period: position.period,
      reconciliation: position.reconciliation,
    }
  }
  const holders = deployed.holders
    .filter((h) => belongs(id, h.external_identity_id))
    .map((holder) => ({ holder, ...balance(holder) }))
    .filter((h) => h.isHolder)
  const remoteHolders = deployed.holders.filter(
    (h) =>
      h.is_holder &&
      belongs(id, h.external_identity_id) &&
      !(
        h.balance.subscription &&
        !h.balance.subscription.ended &&
        h.balance.subscription.limit === 'unlimited'
      ),
  )
  const remoteCaps = deployed.holders
    .filter((h) => h.entitlement && belongs(id, h.external_identity_id))
    .map((h) => h.entitlement!.remaining)
  const remoteValues = [
    ...remoteHolders.map((h) =>
      Math.max((h.balance.credits ?? 0) - (h.balance.usage ?? 0), 0),
    ),
    ...remoteCaps,
  ]
  const remoteRemaining = remoteValues.length ? Math.min(...remoteValues) : 0
  const reconciliation = (remaining: number) => ({
    applied: applied.size > 0,
    eventCount: applied.size,
    remoteRemaining,
    localAdjustment: remaining - remoteRemaining,
  })
  const denied = snapshot.identities.find(
    (identity) =>
      belongs(id, identity.external_id) &&
      identity.entitlements?.meters != null &&
      !identity.entitlements.meters.some((entry) => entry.meter === ref.key),
  )
  if (denied)
    return done({
      allowed: false,
      remaining: 0,
      overage: 0,
      limit: null,
      limitedBy: denied.external_id,
      reason: 'access_denied',
      period: null,
      reconciliation: reconciliation(0),
      holders: [],
    })
  if (!holders.length)
    return done({
      allowed: false,
      remaining: 0,
      overage: 0,
      limit: null,
      limitedBy: null,
      reason: 'no_plan',
      period: null,
      reconciliation: reconciliation(0),
      holders: [],
    })
  // Mirrors the server's check: a holder's policy comes from its running
  // subscription; prepaid credits and ended subscriptions gate hard.
  const limits: LocalHolder[] = holders
    .map(({ holder, state }) => ({
      id: holder.external_identity_id,
      remaining: Math.max(state.credits - state.usage, 0),
      overage: Math.max(state.usage - state.credits, 0),
      limit:
        state.subscription && !state.subscription.ended
          ? state.subscription.limit
          : 'hard',
      period:
        state.boundary !== null && nextBoundary(state) !== null
          ? {
              start: new Date(state.boundary),
              end: new Date(nextBoundary(state)!),
            }
          : null,
    }))
    .sort((a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id))
  const root = holders.find(
    (h) => h.holder.external_identity_id === snapshot.customer.external_id,
  )
  for (const holder of deployed.holders) {
    if (!belongs(id, holder.external_identity_id) || !holder.entitlement)
      continue
    if (usage.aggregation.func !== 'sum' && usage.aggregation.func !== 'count')
      return fail('Usage caps require a sum or count meter')
    const end = root ? nextBoundary(root.state) : null
    const start = end !== null ? root!.state.boundary : null
    if (start === null || end === null)
      return done({
        allowed: false,
        remaining: 0,
        overage: 0,
        limit: null,
        limitedBy: holder.external_identity_id,
        reason: 'missing_period',
        period: null,
        reconciliation: reconciliation(0),
        holders: [],
      })
    const samePeriod =
      holder.entitlement.period_start !== null &&
      Date.parse(holder.entitlement.period_start) === start
    let used = samePeriod ? (holder.entitlement_usage_base ?? 0) : 0
    for (const bucket of buckets.values()) {
      const at = Date.parse(bucket.bucket_start)
      if (
        bucket.reducer_id === usage.id &&
        bucket.value !== null &&
        // Match the server: include the bucket overlapping the root period start.
        at >=
          Math.max(
            Math.floor(start / 300000) * 300000,
            Date.parse(snapshot.since),
          ) &&
        at < now.getTime() &&
        belongs(bucket.external_identity_id, holder.external_identity_id)
      )
        used += bucket.value
    }
    limits.push({
      id: holder.external_identity_id,
      remaining: Math.max(holder.entitlement.cap - used, 0),
      overage: 0,
      limit: 'hard',
      period: { start: new Date(start), end: new Date(end) },
    })
  }
  limits.sort((a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id))
  // The caller applies its estimate after this shared reconciliation.
  const tightest = describe(limits, limits[0])
  return done({
    ...tightest,
    allowed: true,
    reason: 'ok',
    reconciliation: reconciliation(tightest.remaining ?? 0),
    holders: limits,
  })
}

interface LocalHolder {
  id: string
  remaining: number
  overage: number
  limit: Limit
  period: CheckResult['period']
}
type LocalCheck = CheckResult & { readonly holders: readonly LocalHolder[] }

const describe = (limits: readonly LocalHolder[], tightest: LocalHolder) => {
  const capped = limits.filter((h) => h.limit !== 'unlimited')
  const pick =
    capped.includes(tightest) || !capped.length ? tightest : capped[0]
  return {
    remaining: capped.length ? pick.remaining : null,
    overage: pick.overage,
    limit: pick.limit,
    limitedBy: pick.id,
    period: pick.period,
  }
}

/** Apply an estimate to reconciled holders the way the server's check does. */
export const decide = (result: LocalCheck, estimate: number): CheckResult => {
  const { holders, ...rest } = result
  if (!rest.allowed) return rest
  const denying = holders
    .filter((h) => h.limit === 'hard' && h.remaining < estimate)
    .sort((a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id))
  const pick = denying.length
    ? describe(holders, denying[0])
    : describe(holders, holders[0])
  return {
    ...rest,
    ...pick,
    allowed: !denying.length,
    reason: denying.length ? 'cap' : 'ok',
    reconciliation: rest.reconciliation && {
      ...rest.reconciliation,
      localAdjustment:
        (pick.remaining ?? 0) - rest.reconciliation.remoteRemaining,
    },
  }
}

const storageError = (cause: unknown) =>
  cause instanceof VoidError
    ? cause
    : new VoidError({
        reason: 'event_storage',
        message: 'void: local reconciliation failed',
        cause,
      })

/** Ids a forget is already in flight for, per client runtime, so bursts of checks do not repeat it. */
const forgetting = new WeakMap<Background['Service'], Set<string>>()

/**
 * Drop events the snapshot's receipts prove the server has counted. They add
 * nothing to a reconciliation any more, so every store forgets them. The
 * delete runs in the background: it never delays or fails the check, a store
 * that cannot delete is tolerated, and the retention backstop still bounds it.
 */
const forgetIncluded = Effect.fn('Scope.forgetIncluded')(function* (
  config: Config,
  snapshot: CustomerState,
  events: readonly StoredEvent[],
) {
  const included = events.filter((event) => eventIncluded(snapshot, event))
  if (included.length === 0) return events
  const background = yield* Background
  const inFlight = forgetting.get(background) ?? new Set<string>()
  forgetting.set(background, inFlight)
  const ids = included
    .map((event) => `${snapshot.organization_id}\u0000${event.external_id}`)
    .filter((key) => !inFlight.has(key))
  if (ids.length > 0) {
    for (const key of ids) inFlight.add(key)
    yield* background.fork(
      Effect.tryPromise(() =>
        Promise.all(
          config.eventStorage.map((storage) =>
            storage.forget(
              snapshot.organization_id,
              ids.map((key) => key.split('\u0000')[1]!),
            ),
          ),
        ),
      ).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            for (const key of ids) inFlight.delete(key)
          }),
        ),
      ),
    )
  }
  return events.filter((event) => !included.includes(event))
})

/** Read the current local buffer again after recording or rejecting events. */
export const reconciliationEvents = Effect.fn('Scope.reconciliationEvents')(
  function* (
    config: Config,
    snapshot: CustomerState,
    now: Date,
    includeFuture = false,
  ) {
    const names = [
      ...new Set([
        ...config.events.map((event) => event.name),
        'credit.granted',
        'subscription.created',
        'subscription.updated',
        'subscription.canceled',
        'subscription.revoked',
        'subscription.cycled',
      ]),
    ]
    const batches = yield* Effect.tryPromise({
      try: () =>
        Promise.all(
          config.eventStorage.map((storage) =>
            storage.read(snapshot.organization_id, {
              names,
              identities: snapshot.identities.map((i) => i.external_id),
              since: null,
              until: includeFuture ? new Date('9999-12-31T00:00:00Z') : now,
              recordedSince: new Date(now.getTime() - config.eventRetention),
            }),
          ),
        ),
      catch: storageError,
    })
    const pending = new Map<string, StoredEvent>()
    for (const batch of batches) {
      for (const event of batch) {
        if (
          event.organization_id !== snapshot.organization_id ||
          !snapshot.identities.some(
            (i) => i.external_id === event.external_identity_id,
          ) ||
          !names.includes(event.name) ||
          (!includeFuture && Date.parse(event.timestamp) > now.getTime())
        )
          continue
        const existing = pending.get(event.external_id)
        if (
          existing &&
          !isDeepStrictEqual(
            { ...existing, recorded_at: '' },
            { ...event, recorded_at: '' },
          )
        )
          return yield* Effect.fail(
            new VoidError({
              reason: 'reconciliation',
              message: 'void: local databases contain conflicting events',
            }),
          )
        pending.set(event.external_id, event)
      }
    }
    const remaining = yield* forgetIncluded(config, snapshot, [
      ...pending.values(),
    ])
    return remaining.toSorted(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) ||
        a.external_id.localeCompare(b.external_id),
    )
  },
)

/** Read local ranges and merge them into a consistent remote snapshot. */
export const loadReconciliation = Effect.fn('Scope.loadReconciliation')(
  function* (config: Config, ref: MeterDef, id: string, keepTail = false) {
    const api = yield* Api
    const versionId =
      config.versionId === undefined
        ? (yield* api.organizationsCurrent(undefined)).active_version_id
        : config.versionId
    if (versionId === null)
      return fail('no active deployment; run `void deploy --activate`')
    const effectiveConfig = { ...config, versionId }
    const identity = yield* api.identitiesGet(id, undefined)
    const root = identity.chain.at(-1) ?? id
    let snapshot = yield* api.customersState(root, {
      params: {
        version_id: versionId,
        ...(keepTail && {
          since: new Date(
            Math.floor(Date.now() / 300000) * 300000 - 300000,
          ).toISOString(),
        }),
      },
    })
    const deployed = snapshot.meters.find(
      (m) => m.meter.slug === ref.key && m.meter.version_id === versionId,
    )
    if (!deployed)
      return fail(`meter ${ref.key} is missing from customer state`)
    const now = new Date()
    let events: readonly StoredEvent[] = yield* reconciliationEvents(
      config,
      snapshot,
      now,
    )
    if (events.length > 0) {
      // One extra bucket keeps events exactly on a boundary after the remote base.
      const earliest = events.reduce(
        (at, e) => Math.min(at, bucketTime(e.timestamp)),
        now.getTime(),
      )
      snapshot = yield* api.customersState(root, {
        params: {
          version_id: versionId,
          since: new Date(Math.max(0, earliest - 300000)).toISOString(),
        },
      })
      if (Date.parse(snapshot.since) > earliest)
        return fail(
          'customer state omitted the replay window required by local events',
        )
      events = yield* forgetIncluded(config, snapshot, events)
    }
    return {
      snapshot,
      events,
      now: new Date(Math.max(now.getTime(), Date.parse(snapshot.at))),
      storageError,
      effectiveConfig,
    }
  },
)

export const checkLocally = Effect.fn('Scope.checkLocally')(function* (
  config: Config,
  ref: MeterDef,
  id: string,
  estimate: number,
) {
  const { snapshot, events, now, storageError, effectiveConfig } =
    yield* loadReconciliation(config, ref, id)
  return yield* Effect.try({
    try: () => {
      const result = reconcile(effectiveConfig, ref, snapshot, id, events, now)
      return decide(result, estimate)
    },
    catch: storageError,
  })
})

export const balanceLocally = Effect.fn('Scope.balanceLocally')(function* (
  config: Config,
  ref: MeterDef,
  id: string,
) {
  const { snapshot, events, now, storageError, effectiveConfig } =
    yield* loadReconciliation(config, ref, id)
  return yield* Effect.try({
    try: () =>
      reconcile(effectiveConfig, ref, snapshot, id, events, now, 'balance'),
    catch: storageError,
  })
})

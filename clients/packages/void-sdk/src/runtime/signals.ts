import { isDeepStrictEqual } from 'node:util'
import type { Effect } from 'effect'
import type { Api, ApiError } from '../api/index'
import type { RunEffect } from '../api/layers'
import type { Config } from '../config/config'
import {
  isMeterSignal,
  isSenseSignal,
  type MeterSignalRef,
  type SenseSignalRef,
  type SignalRef,
} from '../config/schema'
import { MalformedResponse, VoidError, VoidHttpError } from '../errors'
import type { EventChanges } from '../storage/events'
import type { Background } from './background'
import {
  loadCustomerSnapshot,
  loadReconciliation,
  reconcile,
  reconciliationEvents,
} from '../storage/reconcile'
import type { CustomerSenseState } from '../api/generated'
import type { BalanceResult } from './queries'

const DEFAULT_REFRESH_INTERVAL = 30_000

function asApiError(cause: unknown): ApiError {
  if (
    cause instanceof VoidError ||
    cause instanceof VoidHttpError ||
    cause instanceof MalformedResponse
  )
    return cause
  return new VoidError({
    reason: 'unreachable',
    message: 'Customer state refresh failed',
    cause,
  })
}

function retryable(error: ApiError): boolean {
  if (error instanceof VoidHttpError)
    return error.status === 429 || error.status >= 500
  return error instanceof VoidError && error.reason === 'unreachable'
}

export interface SignalState {
  readonly customerId: string
  readonly identityId: string
  readonly signal: string
  readonly status: 'active' | 'inactive' | 'unknown'
  /** Set on the observation that crossed a threshold; null otherwise. */
  readonly transition: 'entered' | 'exited' | null
  /** True when unconfirmed local events contribute to `balance`. */
  readonly provisional: boolean
  /** When this client evaluated the condition. */
  readonly evaluatedAt: Date
  /** Time of the server baseline. Does not imply all usage has been processed. */
  readonly snapshotAt: Date
  /** The reconciled balance the condition was evaluated against. */
  readonly balance: Pick<
    BalanceResult,
    'remaining' | 'limit' | 'reason' | 'period'
  > | null
  /** Polar's stored noul for a semantic signal; null on meter signals. */
  readonly noul: number | null
}

/** Runs once per published observation, sequentially; a rejection stops the listener. */
export type SignalHandler = (state: SignalState) => void | Promise<void>

export interface SignalListenOptions {
  /**
   * A baseline refresh failed and the SDK will retry it; the listener stays
   * active. Errors that end the listener, such as 401 or 404, reject `closed`
   * instead and are not reported here.
   */
  readonly onRetry?: (error: ApiError) => void
  /**
   * Overrides the config's `signalRefreshInterval` for this listener. Picks up
   * usage recorded by other clients; local events and billing boundaries are
   * applied immediately regardless.
   */
  readonly refreshInterval?: number
  /**
   * Seeds the hysteresis latch when this client has not evaluated the signal
   * yet, so a restart can continue from a persisted status instead of falling
   * back to `inactive` between the two thresholds. The first observation
   * carries no transition. Ignored once the client holds a state.
   */
  readonly initialStatus?: 'active' | 'inactive'
  readonly signal?: AbortSignal
}

export interface SignalSubscription {
  /** Stops the listener. Queued handler calls are dropped; an in-flight one finishes. */
  close(): void
  /**
   * Settles once the listener has stopped. Resolves after `close()` or the
   * abort signal, once any in-flight handler call has finished. Rejects if the
   * listener died on its own: the handler threw, or the server answered with a
   * terminal error such as 401 or 404.
   */
  readonly closed: Promise<void>
}

export interface SignalQuery {
  /** Refresh the server baseline, reconcile local events, and evaluate locally. */
  get(): Promise<SignalState>
  /** Evaluate now and on every change until closed. The handler receives the current state first. */
  listen(
    handler: SignalHandler,
    options?: SignalListenOptions,
  ): SignalSubscription
}

type Loaded = Pick<
  Effect.Success<ReturnType<typeof loadCustomerSnapshot>>,
  'snapshot' | 'effectiveConfig'
>
type Listener = {
  refreshInterval: number
  state(state: SignalState): void
  retry(error: ApiError): void
  fail(error: ApiError): void
  close(): void
}
type Entry = {
  ref: SignalRef
  active: boolean
  stableActive: boolean
  state?: SignalState
  listeners: Set<Listener>
}
type Customer = {
  id: string
  entries: Map<string, Entry>
  loaded?: Loaded
  loading?: Promise<void>
  dirty: boolean
  /** Evaluations run one at a time per customer, in call order. */
  evaluation?: Promise<void>
  timer?: ReturnType<typeof setTimeout>
  retry?: ReturnType<typeof setTimeout>
  poll?: ReturnType<typeof setTimeout>
}

function classifyMeter(
  balance: BalanceResult,
  active: boolean,
  ref: MeterSignalRef,
): SignalState['status'] {
  if (balance.reason !== 'ok') return 'unknown'
  if (balance.remaining === null)
    return balance.limit === 'unlimited' ? 'inactive' : 'unknown'
  if (!Number.isFinite(balance.remaining)) return 'unknown'
  if (active)
    return balance.remaining >= ref.definition.exit.atLeast
      ? 'inactive'
      : 'active'
  return balance.remaining < ref.definition.enter.below ? 'active' : 'inactive'
}

function classifySense(
  noul: number | null,
  active: boolean,
  ref: SenseSignalRef,
): SignalState['status'] {
  if (noul === null || !Number.isFinite(noul)) return 'unknown'
  if (active) return noul < ref.definition.exit.below ? 'inactive' : 'active'
  return noul > ref.definition.enter.above ? 'active' : 'inactive'
}

function senseNoul(
  snapshot: { senses?: ReadonlyArray<CustomerSenseState> },
  identityId: string,
  slug: string,
): number | null {
  const match = (snapshot.senses ?? []).find(
    (row) => row.slug === slug && row.identity_id === identityId,
  )
  return match === undefined ? null : match.noul
}

function observe(
  customerId: string,
  entry: Entry,
  next: {
    status: SignalState['status']
    previousActive: boolean
    provisional: boolean
    now: Date
    snapshotAt: string
    balance: SignalState['balance']
    noul: number | null
  },
): void {
  let transition: SignalState['transition'] = null
  if (next.status === 'active' && !next.previousActive) transition = 'entered'
  if (next.status === 'inactive' && next.previousActive) transition = 'exited'
  const previous = entry.state
  if (
    !previous ||
    previous.status !== next.status ||
    previous.provisional !== next.provisional ||
    previous.noul !== next.noul ||
    !isDeepStrictEqual(previous.balance, next.balance)
  ) {
    entry.state = {
      customerId,
      identityId: customerId,
      signal: entry.ref.key,
      status: next.status,
      transition,
      provisional: next.provisional,
      evaluatedAt: next.now,
      snapshotAt: new Date(next.snapshotAt),
      balance: next.balance,
      noul: next.noul,
    }
    for (const listener of entry.listeners) listener.state(entry.state)
  } else {
    entry.state = { ...previous, snapshotAt: new Date(next.snapshotAt) }
  }
}

/** Signals own conditions; the existing balance fold owns all billing arithmetic. */
export function makeSignals(
  config: Config,
  run: RunEffect<Api | Background>,
  changes?: EventChanges,
) {
  const customers = new Map<string, Customer>()
  let disposed = false

  function listeners(customer: Customer): Listener[] {
    return [...customer.entries.values()].flatMap((entry) => [
      ...entry.listeners,
    ])
  }

  function stop(customer: Customer): void {
    clearTimeout(customer.timer)
    clearTimeout(customer.retry)
    clearTimeout(customer.poll)
    customer.poll = undefined
  }

  /** The only cross-client synchronization: a periodic baseline fetch while listeners exist. */
  function schedulePoll(customer: Customer): void {
    clearTimeout(customer.poll)
    customer.poll = undefined
    const active = listeners(customer)
    if (!active.length || disposed) return
    const interval = Math.min(...active.map((l) => l.refreshInterval))
    customer.poll = setTimeout(
      () => backgroundRefresh(customer),
      Math.min(interval, 2_147_483_647),
    )
  }

  function report(customer: Customer, error: ApiError): void {
    for (const listener of listeners(customer)) {
      if (retryable(error)) listener.retry(error)
      else listener.fail(error)
    }
  }

  function backgroundRefresh(customer: Customer): void {
    void refresh(customer).catch((cause: unknown) => {
      const error = asApiError(cause)
      report(customer, error)
      if (retryable(error) && listeners(customer).length && !disposed) {
        clearTimeout(customer.retry)
        customer.retry = setTimeout(() => backgroundRefresh(customer), 1000)
      }
    })
  }

  function evaluate(customer: Customer, rejected = false): Promise<void> {
    const previous = customer.evaluation ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        if (!customer.loaded || disposed) return
        const { snapshot, effectiveConfig } = customer.loaded
        const hasMeter = [...customer.entries.values()].some((entry) =>
          isMeterSignal(entry.ref),
        )
        const allEvents = hasMeter
          ? await run(reconciliationEvents(config, snapshot, new Date(), true))
          : []
        if (disposed) return
        const now = new Date(Math.max(Date.now(), Date.parse(snapshot.at)))
        const events = allEvents.filter(
          (event) => Date.parse(event.timestamp) <= now.getTime(),
        )
        if (
          events.some(
            (e) =>
              Math.floor(Date.parse(e.timestamp) / 300000) * 300000 <
              Date.parse(snapshot.since),
          )
        ) {
          // A backdated event needs the server's earlier ledger base before it can be merged.
          backgroundRefresh(customer)
          return
        }
        const deadlines: number[] = []
        const balances = new Map<string, BalanceResult>()
        if (snapshot.next_change_at)
          deadlines.push(Date.parse(snapshot.next_change_at))
        for (const entry of customer.entries.values()) {
          const previousActive = entry.active
          if (isSenseSignal(entry.ref)) {
            const noul = senseNoul(snapshot, customer.id, entry.ref.key)
            const status = classifySense(noul, entry.active, entry.ref)
            if (status !== 'unknown') {
              entry.active = status === 'active'
              entry.stableActive = entry.active
            }
            observe(customer.id, entry, {
              status,
              previousActive,
              provisional: false,
              now,
              snapshotAt: snapshot.at,
              balance: null,
              noul,
            })
            continue
          }
          const meter = entry.ref.definition.meter
          const balance =
            balances.get(meter.key) ??
            reconcile(
              effectiveConfig,
              meter,
              snapshot,
              customer.id,
              events,
              now,
              'balance',
            )
          balances.set(meter.key, balance)
          if (rejected) {
            entry.active = entry.stableActive
            // Rebuild the speculative latch without rejected events. Confirmation
            // and ordinary refreshes preserve the condition this client observed.
            const prefix: typeof events = []
            for (const event of events) {
              prefix.push(event)
              const partial = reconcile(
                effectiveConfig,
                meter,
                snapshot,
                customer.id,
                prefix,
                now,
                'balance',
              )
              const status = classifyMeter(partial, entry.active, entry.ref)
              if (status !== 'unknown') entry.active = status === 'active'
            }
          }
          const status = classifyMeter(balance, entry.active, entry.ref)
          if (status !== 'unknown') entry.active = status === 'active'
          const provisional = balance.reconciliation?.applied ?? false
          if (!provisional && status !== 'unknown')
            entry.stableActive = entry.active
          observe(customer.id, entry, {
            status,
            previousActive,
            provisional,
            now,
            snapshotAt: snapshot.at,
            balance: {
              remaining: balance.remaining,
              limit: balance.limit,
              reason: balance.reason,
              period: balance.period,
            },
            noul: null,
          })
          if (balance.period) deadlines.push(balance.period.end.getTime())
        }
        // Only meaningful deadlines wake the SDK; no interval reevaluates idle customers.
        for (const event of allEvents) {
          if (
            event.organization_id === snapshot.organization_id &&
            snapshot.identities.some(
              (i) => i.external_id === event.external_identity_id,
            )
          )
            deadlines.push(Date.parse(event.timestamp))
        }
        clearTimeout(customer.timer)
        const next = deadlines.reduce(
          (next, at) => (at > now.getTime() ? Math.min(next, at) : next),
          Infinity,
        )
        if (Number.isFinite(next) && listeners(customer).length) {
          customer.timer = setTimeout(
            () => {
              void evaluate(customer)
                .catch((cause: unknown) => report(customer, asApiError(cause)))
                .finally(() => backgroundRefresh(customer))
            },
            Math.min(next - Date.now() + 1, 2_147_483_647),
          )
        }
      })
    customer.evaluation = next
    return next
  }

  function refresh(customer: Customer): Promise<void> {
    if (disposed)
      return Promise.reject(
        new VoidError({
          reason: 'invalid_argument',
          message: 'Signal client is disposed',
        }),
      )
    customer.dirty = true
    if (customer.loading) return customer.loading
    customer.loading = Promise.resolve()
      .then(async () => {
        // Return to get() callers even when notifications keep arriving.
        for (let pass = 0; customer.dirty && !disposed && pass < 2; pass++) {
          customer.dirty = false
          if (!customer.entries.size) return
          const meter = [...customer.entries.values()]
            .map((entry) => entry.ref)
            .find(isMeterSignal)?.definition.meter
          const loaded = meter
            ? await run(loadReconciliation(config, meter, customer.id, true))
            : await run(loadCustomerSnapshot(config, customer.id))
          if (meter && loaded.snapshot.customer.external_id !== customer.id)
            throw new VoidError({
              reason: 'invalid_argument',
              message: 'Signals require a root customer identity',
            })
          if (disposed) return
          clearTimeout(customer.retry)
          customer.loaded = {
            snapshot: loaded.snapshot,
            effectiveConfig: loaded.effectiveConfig,
          }
          await evaluate(customer)
        }
      })
      .finally(() => {
        customer.loading = undefined
        // A refresh request can arrive after the loop's final check but before
        // this promise settles, including from a listener callback.
        if (customer.dirty && listeners(customer).length && !disposed)
          backgroundRefresh(customer)
        else schedulePoll(customer)
      })
    return customer.loading
  }

  function start(customer: Customer): void {
    if (disposed || !listeners(customer).length) return
    // The first listener takes a fresh baseline; later ones join the running loop.
    if (!customer.poll && !customer.loading) backgroundRefresh(customer)
    else schedulePoll(customer)
  }

  const detach = changes?.subscribe((rejected) => {
    for (const customer of customers.values()) {
      void evaluate(customer, rejected).catch((cause: unknown) =>
        report(customer, asApiError(cause)),
      )
    }
  })

  function query(customerId: string, ref: SignalRef): SignalQuery {
    function bind() {
      let customer = customers.get(customerId)
      if (!customer) {
        customer = {
          id: customerId,
          entries: new Map(),
          dirty: false,
        }
        customers.set(customerId, customer)
      }
      const group = customer
      let entry = group.entries.get(ref.key)
      if (!entry) {
        entry = {
          ref,
          active: false,
          stableActive: false,
          listeners: new Set(),
        }
        group.entries.set(ref.key, entry)
      }
      return { group, condition: entry }
    }

    function listen(
      handler: SignalHandler,
      options: SignalListenOptions = {},
    ): SignalSubscription {
      if (typeof handler !== 'function')
        throw new VoidError({
          reason: 'invalid_argument',
          message: 'listen(handler, options?) requires a handler function',
        })
      const { group, condition } = bind()
      if (
        options.initialStatus !== undefined &&
        options.initialStatus !== 'active' &&
        options.initialStatus !== 'inactive'
      )
        throw new VoidError({
          reason: 'invalid_argument',
          message: "initialStatus must be 'active' or 'inactive'",
        })
      if (options.initialStatus !== undefined && !condition.state) {
        condition.active = options.initialStatus === 'active'
        condition.stableActive = condition.active
      }
      let stopped = false
      let tail = Promise.resolve()
      let resolveClosed: () => void = () => undefined
      let rejectClosed: (error: ApiError) => void = () => undefined
      const closed = new Promise<void>((resolve, reject) => {
        resolveClosed = resolve
        rejectClosed = reject
      })
      void closed.catch(() => undefined)
      function finish(error?: ApiError): void {
        if (stopped) return
        stopped = true
        options.signal?.removeEventListener('abort', close)
        condition.listeners.delete(listener)
        if (!listeners(group).length) stop(group)
        else schedulePoll(group)
        if (error) rejectClosed(error)
        else void tail.then(resolveClosed)
      }
      function close(): void {
        finish()
      }
      function callback(run: () => void): void {
        if (stopped) return
        try {
          run()
        } catch (cause) {
          finish(
            new VoidError({
              reason: 'invalid_argument',
              message: 'Signal callback failed',
              cause,
            }),
          )
        }
      }
      const refreshInterval =
        options.refreshInterval ??
        config.signalRefreshInterval ??
        DEFAULT_REFRESH_INTERVAL
      if (!(Number.isFinite(refreshInterval) && refreshInterval > 0))
        throw new VoidError({
          reason: 'invalid_argument',
          message: 'refreshInterval must be a positive number of milliseconds',
        })
      const listener: Listener = {
        refreshInterval,
        state(state) {
          tail = tail.then(async () => {
            if (stopped) return
            try {
              await handler(state)
            } catch (cause) {
              finish(
                new VoidError({
                  reason: 'invalid_argument',
                  message: 'Signal handler failed',
                  cause,
                }),
              )
            }
          })
        },
        retry: (error) => callback(() => options.onRetry?.(error)),
        fail: (error) => finish(error),
        close,
      }
      condition.listeners.add(listener)
      options.signal?.addEventListener('abort', close, { once: true })
      if (disposed || options.signal?.aborted) close()
      else {
        if (condition.state) listener.state(condition.state)
        else if (group.loaded) {
          void evaluate(group).catch((cause: unknown) =>
            listener.fail(asApiError(cause)),
          )
        }
        start(group)
      }
      return { close, closed }
    }
    return {
      async get() {
        const { group, condition } = bind()
        await refresh(group)
        if (!condition.state)
          throw new VoidError({
            reason: 'reconciliation',
            message: 'Signal has no snapshot',
          })
        return condition.state
      },
      listen,
    }
  }

  return {
    query,
    async refresh() {
      await Promise.all([...customers.values()].map(refresh))
    },
    close() {
      disposed = true
      detach?.()
      for (const customer of customers.values()) {
        for (const listener of listeners(customer)) listener.close()
        stop(customer)
      }
      customers.clear()
    },
  }
}

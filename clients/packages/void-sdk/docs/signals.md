# SDK signals

A signal is a local condition the SDK latches. Meter signals watch a reconciled
balance. Semantic signals ask Polar one question about a meter's recent events
and latch Jev's answer. Polar does not latch, persist signal history, or push
webhooks; `enter` / `exit`, and the question itself, stay in the SDK and never
change the deploy checksum.

## Define and use a signal

```ts
import { createVoid, defineConfig, event, meter, signal, sum } from '@void/sdk'

const used = event<{ amount: number }>('credits.used')
const credits = meter('credits', {
  reducer: sum(used, 'amount'),
  price: { amount: 0 },
})
const budgetLow = signal('budget-low', {
  meter: credits,
  field: 'remaining',
  enter: { below: 100 },
  exit: { atLeast: 150 },
})
const config = defineConfig({
  schema: { used, credits, budgetLow },
  signalRefreshInterval: 10_000,
})
const client = createVoid(config, {
  apiUrl: process.env.VOID_API_URL!,
  token: process.env.VOID_TOKEN!,
})

const customer = client.as(customerId)
const budget = customer.signals.budgetLow
const current = await budget.get()

const subscription = budget.listen(
  async (state) => {
    if (state.status === 'unknown') return
    await routing.setTier(
      state.customerId,
      state.status === 'active' ? 'economy' : 'standard',
    )
  },
  { onRetry: (error) => console.warn('refresh failed, retrying', error) },
)

await customer.events.used.record({ amount: 30 }, { id: usageEventId })

// On shutdown:
subscription.close()
await subscription.closed
await client.dispose()
```

## Semantic signals

```ts
import { recent, signal } from '@void/sdk'

const retryStorm = signal('retry-storm', {
  meter: tokens,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'), // the default
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})
```

A semantic signal names a meter and a question. Nothing about it is deployed:
the meter deploys as usual, and the SDK sends `when` and `over` to Polar on
every refresh through `POST /v1/void/identities/{external_id}/judge`. Polar
reads the identity's events in the window that match the meter's usage reducer
(the identity's own subtree, so a root sees its children and a child sees only
itself), summarizes them, asks Jev the question verbatim, and returns a noul in
`[0, 1]` with the evidence Jev saw. The SDK latches `enter.above` / `exit.below`.
Editing the question is a code change, not a billing version.

`client.as(agentId).signals.retryStorm.get()` judges the agent itself. There is
no root requirement for semantic signals. Windows go up to 7 days.

### What Polar spends on Jev

Polar asks Jev once per distinct window state and never for an idle identity:

- No listener or `get()`, no call. Judging only happens when the SDK asks.
- Empty window, no call. The noul is `0` and the signal resolves to inactive,
  so a storm that ended hours ago clears on its own once the window drains.
- Unchanged window, no call. The same events give the cached answer.
- At most one call a minute per identity and question. New events inside that
  minute return the previous noul with `stale: true` in the judgment.
- Evidence is capped at the first and the most recent 39 events; totals and
  distinct values cover the whole window.

Worst case is one Jev call per listened identity per minute while that identity
is actively spending on the meter.

### Unknown answers

If Jev cannot be asked, Polar returns a null noul and the SDK reports `unknown`,
keeping the last latched condition. If an earlier answer exists, Polar returns it
with `stale: true` instead. Nothing here surfaces as an HTTP error, so the
listener keeps running.

## Evaluation

For meter thresholds 100 and 150, balances `180 → 95 → 80 → 110 → 160` produce
`inactive → active → active → active → inactive`. Entry is strictly below 100;
exit is at or above 150. Thresholds must be finite, with
`0 < enter.below < exit.atLeast`.

Semantic signals latch the other way: nouls `0.5 → 0.8 → 0.55 → 0.3` with
`enter.above` 0.7 and `exit.below` 0.4 produce
`inactive → active → active → inactive`. Thresholds must be finite, with
`0 < exit.below < enter.above <= 1`.

Meter signals use the same balance fold as reconciled checks and balances,
including credits, holder limits, entitlement caps, and subscription periods.
Unlimited balances are inactive. Missing holders or periods and denied access are
unknown. Unknown observations preserve the last known active/inactive condition.

`get()` fetches a server baseline, merges local events, and evaluates locally. It
does not start a background connection. `listen()` initializes the baseline and
then reacts to:

- Events recorded through this client's scoped or raw ingestion interfaces.
- A periodic server baseline refresh, which picks up usage recorded by other SDK
  instances and processed billing events. Semantic signals are re-judged on the
  same refresh.
- Known billing boundaries, scheduled subscription changes, and future local events.
- An explicit `get()` or `client.refresh()`.

Once initialized, recording an event updates the cached balance and meter signal
before waiting for the upload response. Semantic signals follow the server alone:
a local event changes nothing until the next refresh. A cold client needs its
first server snapshot. A backdated event older than the cached replay window
needs an earlier snapshot before it can be reconciled. Direct writes to SQLite
outside the client do not produce a local notification; call `get()` or
`client.refresh()` afterward.

Speculation requires `eventStorage`. The SDK reads the events this client wrote
back from that storage and merges them into the server baseline, so they survive
restarts too. Without `eventStorage`, meter signals follow the server alone:
recording an event changes nothing locally, `provisional` is always false, and the
condition updates once the reducer pipeline has processed the event and the next
refresh observes it. SQLite remains a caller-owned connection and is not closed
by `client.dispose()`.

An upload acknowledgement does not remove the local adjustment. Exact server
bucket receipts determine when the event is already included. HTTP 400, 404, 409,
and 422 responses exclude the rejected batch from local reconciliation and undo
its speculative condition. Network errors and other HTTP failures retain the
pending events. Uploads are not automatically retried; retry with the same event
IDs. A retry of a rejected event makes it eligible for reconciliation again.

Each client maintains its own hysteresis history. Restarting starts a new history,
using the current balance and available local events, so a balance between the two
thresholds starts `inactive`. Pass `initialStatus: 'active'` to `listen()` to
continue from a status you persisted; the first observation then carries no
transition. The seed only applies while the client has no state for that signal,
and the next threshold crossing corrects a wrong seed. Clients can temporarily
observe different conditions. Signals do not execute when no client is running,
and there is no central signal history, webhook delivery, or shared spending lock.

## Observations

```ts
{
  customerId: 'customer_123',
  signal: 'budget-low',
  status: 'active',
  transition: 'entered',
  provisional: true,
  evaluatedAt: new Date('2026-09-12T12:00:00.000Z'),
  snapshotAt: new Date('2026-09-12T11:59:59.000Z'),
  balance: { remaining: 90, limit: 'hard', reason: 'ok', period: { start, end } },
  noul: null,
  evidence: null,
}
```

`balance` is the subset of the meter's `BalanceResult` the condition was evaluated
against. `provisional` says that local events contribute to it. A false value
means there is no local adjustment, not that all other clients' usage is processed.
`snapshotAt` exposes the server baseline's age. `evaluatedAt` records when the SDK
evaluated the condition.

On a semantic signal `balance` is null, `noul` is Jev's answer, `evidence` is what
Jev saw (event count, identities, first and last timestamps, numeric totals,
distinct string values, and the sampled events), and `snapshotAt` is when Jev
answered. Both are null while the answer is unknown.

A change in status, balance, noul, evidence, or provisional status publishes an
observation. Unchanged refreshes do not invoke the handler again. A new listener
receives the current state, including any transition attached to that observation.
Initially active emits `entered`; unknown never emits `exited`. Callbacks are
state synchronization, not exactly-once business actions.

Callbacks run sequentially per listener and may return promises. A throwing
callback stops that listener and rejects `closed`. Closing suppresses queued
callbacks and waits for the current callback to finish. Other listeners continue.
An optional AbortSignal closes the listener. `client.dispose()` closes all listeners.

## Customer state synchronization

All signals listened to for one identity in a client share one refresh loop.
While at least one listener exists, the SDK refreshes every
`signalRefreshInterval` milliseconds from `defineConfig`, default 30 seconds,
measured from the end of the previous refresh. A refresh fetches
`GET /v1/customers/{external_id}/state` when the group has a meter signal and
judges each semantic signal. The setting is runtime-only and does not affect the
deployment checksum. A listener can pass `refreshInterval` to override it; when
listeners on the same identity disagree, the loop runs at the shortest. `get()`,
`client.refresh()`, and boundary wake-ups also count as refreshes and push the
next scheduled one out. A failed refresh retries after one second while listeners
remain active and is reported to `onRetry`; terminal errors such as 401 or 404
reject the subscription's `closed` promise instead and stop the listener.

There is no server push. Polar does not track connected clients, and nothing
happens on the server when a bucket is recomputed beyond the write itself. Usage
recorded through this client is applied immediately to meter signals; usage
recorded elsewhere is visible after the next refresh, once the reducer pipeline
has processed it. Pick a shorter interval when several instances share a customer
and the reaction time matters, and a longer one to reduce read load. Semantic
signals gain nothing from an interval under a minute; Polar answers from its
cache inside that window.

Each refresh is a full customer-state read. `next_change_at` in that response
tells the SDK when a subscription starts or ends so it can wake without knowing
why. This observes state and can coalesce brief crossings between refreshes. It
does not guarantee replay of every historical threshold crossing.

## Tests

From Polar's `clients/` directory, run SDK tests with
`pnpm --filter @void/sdk test`. Server tests live in `server/tests/void/judge`.

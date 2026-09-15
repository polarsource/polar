# SDK signals

A signal is a local condition over a reconciled meter balance. Void evaluates it
inside your SDK client. Polar processes billing events and serves customer state;
it does not evaluate, persist, or push signals.

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

The source meter and its reducers are collected automatically and must be deployed
as usual. Signal definitions stay in the SDK. Threshold changes do not affect the
deployment checksum, create a billing version, or require `void deploy`.
`signal(slug)` without a definition is no longer supported.

Signals currently require a root customer. Child usage contributes to the root's
balance through the existing reconciliation rules. Meter selection follows the
client's configured version, or the organization's default when omitted.

## Evaluation

For thresholds 100 and 150, balances `180 → 95 → 80 → 110 → 160` produce
`inactive → active → active → active → inactive`. Entry is strictly below 100;
exit is at or above 150. Thresholds must be finite, with
`0 < enter.below < exit.atLeast`.

Signals use the same balance fold as reconciled checks and balances, including
credits, holder limits, entitlement caps, and subscription periods. Unlimited
balances are inactive. Missing holders or periods and denied access are unknown.
Unknown observations preserve the last known active/inactive condition.

`get()` fetches a server baseline, merges local events, and evaluates locally. It
does not start a background connection. `listen()` initializes the baseline and
then reacts to:

- Events recorded through this client's scoped or raw ingestion interfaces.
- A periodic server baseline refresh, which picks up usage recorded by other SDK
  instances and processed billing events.
- Known billing boundaries, scheduled subscription changes, and future local events.
- An explicit `get()` or `client.refresh()`.

Once initialized, recording an event updates the cached balance and signal before
waiting for the upload response. A cold client needs its first server snapshot.
A backdated event older than the cached replay window needs an earlier snapshot
before it can be reconciled. Direct writes to SQLite outside the client do not
produce a local notification; call `get()` or `client.refresh()` afterward.

Speculation requires `eventStorage`. The SDK reads the events this client wrote
back from that storage and merges them into the server baseline, so they survive
restarts too. Without `eventStorage`, signals follow the server alone: recording
an event changes nothing locally, `provisional` is always false, and the
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
}
```

`balance` is the subset of the meter's `BalanceResult` the condition was evaluated
against. `provisional` says that local events contribute to it. A false value
means there is no local adjustment, not that all other clients' usage is processed.
`snapshotAt` exposes the server baseline's age. `evaluatedAt` records when the SDK
evaluated the condition.

A change in status, balance, or provisional status publishes an observation.
Unchanged refreshes do not invoke the handler again. A new listener receives the
current state, including any transition attached to that observation. Initially
active emits `entered`; unknown never emits `exited`. Callbacks are state
synchronization, not exactly-once business actions.

Callbacks run sequentially per listener and may return promises. A throwing
callback stops that listener and rejects `closed`. Closing suppresses queued
callbacks and waits for the current callback to finish. Other listeners continue.
An optional AbortSignal closes the listener. `client.dispose()` closes all listeners.

## Customer state synchronization

All signals listened to for one customer in a client share one refresh loop.
While at least one listener exists, the SDK fetches
`GET /v1/customers/{external_id}/state` every `signalRefreshInterval`
milliseconds from `defineConfig`, default 30 seconds, measured from the end of
the previous refresh. The setting is runtime-only and does not affect the
deployment checksum. A listener can pass `refreshInterval` to override it; when
listeners on the same customer disagree, the loop runs at the shortest. `get()`,
`client.refresh()`, and boundary wake-ups also count as refreshes and push the
next scheduled one out. A failed refresh retries after one second while listeners
remain active and is reported to `onRetry`; terminal errors such as 401 or 404
reject the subscription's `closed` promise instead and stop the listener.

There is no server push. Polar does not track connected clients, and nothing
happens on the server when a bucket is recomputed beyond the write itself. Usage
recorded through this client is applied immediately; usage recorded elsewhere is
visible after the next refresh, once the reducer pipeline has processed it. Pick a
shorter interval when several instances share a customer and the reaction time
matters, and a longer one to reduce read load.

Each refresh is a full customer-state read. `next_change_at` in that response
tells the SDK when a subscription starts or ends so it can wake without knowing
why. This observes state and can coalesce brief crossings between refreshes. It
does not guarantee replay of every historical threshold crossing.

## Tests

From Polar's `clients/` directory, run SDK tests with
`pnpm --filter @void/sdk test`. Server tests still live in the original Void
checkout.

# Polar TypeScript SDK

The official TypeScript client for the [Polar API](https://polar.sh/docs/api-reference).

## Installation

```bash
pnpm add @polar-sh/sdk
```

or, with `npm`:

```bash
npm install @polar-sh/sdk
```

## Quick Start

Create an [organization access token](https://polar.sh/docs/integrate/oat) and use the client for
the current API version:

```typescript
import { createPolar } from "@polar-sh/sdk/2026-10";

const polar = createPolar({
    accessToken: "polar_oat_xxx",
});

const customerState = await polar.customers.getStateExternal("customer_external_id");
console.log(customerState);
```

The client uses the production environment by default. To use the sandbox, pass
`environment: "sandbox"` to `createPolar`. Sandbox and production access tokens are separate.

Keep organization access tokens on the server and never expose them in browser or client-side
code.

## Request Timeouts

Set the default timeout for all requests when creating the client. Timeout values are expressed
in seconds:

```typescript
const polar = createPolar({
    accessToken: "polar_oat_xxx",
    timeout: 30,
});
```

Override the timeout for an individual request with the final request options argument:

```typescript
const customerState = await polar.customers.getStateExternal("customer_external_id", {
    timeout: 60,
});
```

Override the access token for an individual request the same way:

```typescript
const customerState = await polar.customers.getStateExternal("customer_external_id", {
    accessToken: "polar_at_u_override",
});
```

## Organizations

OAuth access tokens and personal access tokens can reach every organization the user belongs to.
Pass `organizationId` to get a client that acts on a single organization. It sends the
`Polar-Organization` header, so the API only returns and changes that organization's data:

```typescript
const acme = createPolar({
    accessToken: "polar_at_u_xxx",
    organizationId: "acme_organization_id",
});
const customers = await acme.customers.list();
```

Organization access tokens already act on their own organization and don't need it.

## Individual API Functions

To import individual API functions for tree-shaking, create a core client and pass it to the
function:

```typescript
import { createPolarCore } from "@polar-sh/sdk/2026-10";
import { getStateExternalCustomers } from "@polar-sh/sdk/2026-10/services/customers";

const polar = createPolarCore({
    accessToken: "polar_oat_xxx",
});

const customerState = await getStateExternalCustomers(polar)("customer_external_id");
console.log(customerState);
```

## Actors and event delivery

Create one shared client outside your request handler. Bind a customer and optional member
with `polar.actor()`.

```typescript
import { createPolar } from "@polar-sh/sdk/2026-10";

const polar = createPolar({ accessToken: "polar_oat_xxx" });

async function recordUsage() {
    const actor = polar.actor({ external_customer_id: "customer_123" });
    await actor.track({ name: "api_request", metadata: { tokens: 42 } });
    const usage = await actor.meter("meter_uuid");
}
```

Use `polar.track(...)` or `polar.meter(...)` to pass the customer ID on each call.
`track()` resolves once the queue accepts the event. It assigns a timestamp and external ID
when omitted. Meter reads are customer-wide and work without a queue.

### Delivery

On long-running servers such as Express, the buffer sends batches by size or interval.
Call `await polar.close()` during graceful shutdown to drain events and release resources.
Closing stops new event and meter operations and is idempotent.

In serverless handlers, flush before returning so the function does not freeze with events
in the queue:

```typescript
export async function POST() {
    await polar.track({ name: "api_request", external_customer_id: "customer_123" });
    await polar.flush();
    return Response.json({ ok: true });
}
```

In a Next.js App Router Route Handler, use [`after()`](https://nextjs.org/docs/app/api-reference/functions/after)
to flush the queue after the response. Queue the event in the handler, then return
the `flush()` promise from the callback so Next.js can wait for delivery.

```typescript
import { after } from "next/server";

export async function POST() {
    await polar.track({ name: "api_request", external_customer_id: "customer_123" });
    after(() => polar.flush());

    return Response.json({ ok: true });
}
```

The response can return before delivery is confirmed. The callback still counts toward the
route's maximum duration.

`flush()` waits for events queued before its call, unless a newer flush starts whose deadline
is no earlier than its own: the newer one releases it and waits for its events too. One waiter
keeps a serverless function alive, so concurrent requests do not each stay open for a round
trip to Polar. A resolved `flush()` therefore does not prove Polar accepted the request's events
when other requests flush at the same time. Concurrent requests share HTTP batches; calling
`flush()` does not close the client or create a separate buffer. This is a shared queue barrier, not request-specific delivery.

Dropped events are retained for reporting until a completed flush or close acknowledges them.
The newest overlapping flush reports failures within its boundary, including background drops
from before the flush. After reporting a failure, later flushes can succeed for healthy traffic.
Long-running applications should periodically flush to observe failures and release their
retained event records. Callbacks alone do not acknowledge failures.

`flush()` and `close()` wait up to 30 seconds by default. Override the wait per call:

```typescript
await polar.flush({ timeoutMs: 60_000 });
await polar.close({ timeoutMs: 10_000 });
```

A flush timeout stops only the caller's wait; delivery and other callers continue. It does not
acknowledge failures, so a later flush can observe the eventual outcome. Shutdown aborts
unfinished buffered delivery at its deadline. Timeouts do not confirm that an event is absent
from Polar: the API may have accepted it before the connection failed.

Delivery failures reject with `MeteringDeliveryError` from `@polar-sh/sdk/metering`. Its `events`
and `failures` describe unconfirmed events, reasons, and original causes. Lifecycle timeouts
reject with `MeteringTimeoutError`; a flush waiting on pending events can instead report a
`MeteringDeliveryError` with reason `flush_timeout`. Unexpected worker errors also reject. The memory queue logs delivery hook failures and continues delivering events.

The buffer retries network and server errors with exponential backoff and jitter. Rate limits
honor `Retry-After`, up to five minutes per batch; caller deadlines can expire sooner. Other
Polar API errors drop the batch without retrying. Successful delivery means API acceptance,
not immediate visibility in meter reads. Buffers and failure records are in memory: forced
termination still requires external durable storage and replay for strict no-loss delivery.

### Read meters

Read a customer's meter directly or through an actor:

```typescript
const meter = await polar.meter("meter_uuid", {
    external_customer_id: "customer_123",
});
const actorMeter = await actor.meter("meter_uuid");
if (meter !== null) console.log(meter.consumed_units, meter.credited_units, meter.balance);
```

### Local reduction with Outpost

Pass `outpost()` from `@polar-sh/sdk/outpost` to `createPolar` to enable Redis-backed local meter reads.
The client opens Outpost on first use and shares its authenticated HTTP transport.
Outpost requires the optional `ioredis` and `@opentelemetry/*` peer dependencies.

```typescript
import { outpost } from "@polar-sh/sdk/outpost";

const polar = createPolar({
    accessToken: "polar_oat_xxx",
    outpost: outpost({ redis: "redis://localhost:6379" }),
});
```

Outpost applies events locally after enqueue succeeds. If Outpost cannot answer a meter read,
the client queries the Polar API. `snapshotTimeout` controls the wait for an initial snapshot.

### Choose a queue

The client uses a `MemoryEventQueue` by default and opens it on the first `track()` or
`flush()`. Pass `eventQueue` to customize delivery or `eventQueue: null` to disable it.

```typescript
import { MemoryEventQueue } from "@polar-sh/sdk/metering";

const polar = createPolar({
    accessToken: "polar_oat_xxx",
    eventQueue: new MemoryEventQueue({ batchSize: 50 }),
});
```

`RedisEventQueue` from `@polar-sh/sdk/metering/queue/redis` uses a Redis stream for persistent
delivery. Either queue can be used with Outpost.

```typescript
import { RedisEventQueue } from "@polar-sh/sdk/metering/queue/redis";
import { outpost } from "@polar-sh/sdk/outpost";

const redis = "redis://localhost:6379";
const polar = createPolar({
    accessToken: "polar_oat_xxx",
    eventQueue: new RedisEventQueue(redis, { stream: "my-app:metering" }),
    outpost: outpost({ redis }),
});
```

The SDK opens a single Redis client when the queue and Outpost use the same URL. Both also
accept an existing `ioredis` client, which your application manages and closes.

#### MemoryEventQueue options

| Option            | Default | Meaning                                                |
| ----------------- | ------- | ------------------------------------------------------ |
| `batchSize`       | `100`   | Maximum events per HTTP request.                       |
| `batchIntervalMs` | `1000`  | Milliseconds to collect a batch after its first event. |
| `maxAttempts`     | `3`     | Total attempts per batch, including the first.         |

#### Outpost options

| Option            | Default  | Meaning                                                  |
| ----------------- | -------- | -------------------------------------------------------- |
| `redis`           | Required | Redis instance used by Outpost.                          |
| `telemetry`       | `true`   | Send Outpost metrics and traces to Polar.                |
| `snapshotTimeout` | `5000`   | Milliseconds a cold read waits for its initial snapshot. |

Telemetry can also be disabled with `POLAR_OUTPOST_TELEMETRY=0`.

### Delivery callbacks

Pass `onEventAck(events)` and `onEventRejected(events, reason)` to `createPolar` to observe
delivery. The client runs the corresponding Outpost hook first when Outpost is enabled.
If your callback throws, the client logs the error type and continues settling the events.

## Webhooks

Use `webhooks.validateEvent` to verify that a webhook was sent by Polar and parse it into a typed
payload for the selected API version. Pass the raw request body, the request headers, and your
webhook signing secret:

```typescript
import express from "express";
import { webhooks } from "@polar-sh/sdk/2026-10";

const app = express();
const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

if (!webhookSecret) {
    throw new Error("POLAR_WEBHOOK_SECRET is required");
}

const rawBody = express.raw({ type: "application/json" });
app.post("/webhooks/polar", rawBody, async (request, response) => {
    try {
        const event = await webhooks.validateEvent(
            request.body,
            {
                "webhook-id": request.header("webhook-id") ?? "",
                "webhook-timestamp": request.header("webhook-timestamp") ?? "",
                "webhook-signature": request.header("webhook-signature") ?? "",
            },
            webhookSecret,
        );

        if (event.type === "order.created") {
            console.log(event.data.id);
        }

        response.status(200).json({ received: true });
    } catch (error) {
        if (error instanceof webhooks.PolarWebhookVerificationError) {
            response.status(403).json({ error: "Invalid webhook signature" });
            return;
        }
        if (error instanceof webhooks.PolarWebhookError) {
            response.status(400).json({ error: "Invalid webhook payload" });
            return;
        }
        throw error;
    }
});
```

The `express.raw` middleware is required because the signature must be checked against the body
before it is parsed. Verification accepts Polar's original HMAC key (UTF-8 bytes of the full
secret, including `whsec_`) and the Standard Webhooks key (base64-decode of the remainder after
`whsec_`). `validateEvent` throws `PolarWebhookVerificationError` for invalid signatures
and `PolarWebhookUnknownTypeError` when the event is not supported by the selected API version.
Both inherit from `PolarWebhookError`.

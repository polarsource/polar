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

## Metering

The metering helper buffers and batches events, with optional local reduction through Outpost.
Create one shared helper outside your request handler. Resources start on the first operation;
there is no explicit startup or async disposal step.

```typescript
import { createPolar } from "@polar-sh/sdk/2026-10";

const polar = createPolar({ accessToken: "polar_oat_xxx" });
const metering = polar.metering();

async function recordUsage() {
    await metering.track({
        name: "api_request",
        external_customer_id: "customer_123",
        metadata: { tokens: 42 },
    });
}
```

`track()` resolves when the event is queued, not when Polar accepts it. Events without a
`timestamp` are dated when you call `track()`.

### Actor context

Bind a customer once when tracking several events. Actor creation may warm Outpost state.

```typescript
const actor = await metering.actor({ external_customer_id: "customer_123" });
await actor.track({ name: "api_request", metadata: { tokens: 42 } });
await actor.track({ name: "api_request", metadata: { tokens: 17 } });
```

### Delivery

On long-running servers such as Express, the buffer sends batches by size or interval.
Call `await metering.close()` during graceful shutdown to drain events and release resources.
Closing stops new operations and is idempotent; a closed helper cannot be reused.

In serverless handlers, wait for delivery before returning:

```typescript
export async function POST() {
    await metering.track({ name: "api_request", external_customer_id: "customer_123" });
    await metering.flush();
    return Response.json({ ok: true });
}
```

In a Next.js App Router Route Handler, use [`after()`](https://nextjs.org/docs/app/api-reference/functions/after)
to flush the queue after the response. Queue the event in the handler, then return
the `flush()` promise from the callback so Next.js can wait for delivery.

```typescript
import { after } from "next/server";

export async function POST() {
    await metering.track({ name: "api_request", external_customer_id: "customer_123" });
    after(() => metering.flush());

    return Response.json({ ok: true });
}
```

The response can return before delivery is confirmed. Await `flush()` in the handler
itself when the response needs to confirm Polar accepted the events. The callback
still counts toward the route's maximum duration.

`flush()` waits for events queued before its call. Concurrent requests share HTTP batches;
calling `flush()` does not close the helper or create a separate buffer. Later events are
outside that flush's boundary. This is a shared queue barrier, not request-specific delivery.

Dropped events are retained for reporting until a completed flush or close acknowledges them.
Every overlapping flush reports failures within its boundary, including background drops from
before the flush. After reporting a failure, later flushes can succeed for healthy traffic.
Long-running applications should periodically flush to observe failures and release their
retained event records. Callbacks alone do not acknowledge failures.

`flush()` and `close()` wait up to 30 seconds by default. Override the wait per call:

```typescript
await metering.flush({ timeoutMs: 60_000 });
await metering.close({ timeoutMs: 10_000 });
```

A flush timeout stops only the caller's wait; delivery and other callers continue. It does not
acknowledge failures, so a later flush can observe the eventual outcome. Shutdown aborts
unfinished buffered delivery at its deadline. Timeouts do not confirm that an event is absent
from Polar: the API may have accepted it before the connection failed.

Delivery failures reject with `MeteringDeliveryError` from `@polar-sh/sdk/metering`. Its `events`
and `failures` describe unconfirmed events, reasons, and original causes. Lifecycle timeouts
reject with `MeteringTimeoutError`; a flush waiting on pending events can instead report a
`MeteringDeliveryError` with reason `flush_timeout`. Unexpected worker or callback errors also
reject; callbacks are still called and never turn a drop into a successful flush.

The buffer retries network and server errors with exponential backoff and jitter. Rate limits
honor `Retry-After`, up to five minutes per batch; caller deadlines can expire sooner. Other
Polar API errors drop the batch without retrying. Successful delivery means API acceptance,
not immediate visibility in meter reads. Buffers and failure records are in memory: forced
termination still requires external durable storage and replay for strict no-loss delivery.

### Read meters

Read a customer's meter directly or through an actor:

```typescript
const meter = await metering.meter("meter_uuid", {
    external_customer_id: "customer_123",
});
const actorMeter = await actor.meter("meter_uuid");
if (meter !== null) console.log(meter.consumed_units, meter.credited_units, meter.balance);
```

### Local reduction with Outpost

Pass `outpost: true` to `polar.metering()` to enable Redis-backed local reduction, using
`REDIS_URL`. Pass an object to configure it. This provides low-latency meter reads across
clients. Every Outpost event requires an `external_id`; `track()` rejects events without one.
An event counts locally until Polar confirms storage or the buffer gives it up.

### Options

#### Buffered

| Option            | Default     | Meaning                                                     |
| ----------------- | ----------- | ----------------------------------------------------------- |
| `batchSize`       | `100`       | Maximum events per HTTP request.                            |
| `batchIntervalMs` | `1000`      | Milliseconds to collect a batch after its first event.      |
| `maxAttempts`     | `3`         | Total attempts per batch, including the first.              |
| `onDelivered`     | `undefined` | Callback for events Polar accepted; may be async.           |
| `onDropped`       | `undefined` | Callback for dropped events and their reason; may be async. |

#### Outpost

| Option            | Default                          | Meaning                                                    |
| ----------------- | -------------------------------- | ---------------------------------------------------------- |
| `redisUrl`        | `REDIS_URL` environment variable | Redis instance used by Outpost.                            |
| `telemetry`       | `true`                           | Send Outpost metrics and traces to Polar.                  |
| `snapshotTimeout` | `5000`                           | Milliseconds a cold read waits for its initial snapshot.   |
| `confirmTimeout`  | `2000`                           | Milliseconds a snapshot waits for Polar to confirm events. |

Telemetry can also be disabled with `POLAR_OUTPOST_TELEMETRY=0`.

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

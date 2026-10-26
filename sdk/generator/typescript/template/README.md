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
import { createPolar } from "@polar-sh/sdk/{{ (ir.versions[-2] | default({})).version }}";

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
import { createPolarCore } from "@polar-sh/sdk/{{ (ir.versions[-2] | default({})).version }}";
import { getStateExternalCustomers } from "@polar-sh/sdk/{{ (ir.versions[-2] | default({})).version }}/services/customers";

const polar = createPolarCore({
  accessToken: "polar_oat_xxx",
});

const customerState = await getStateExternalCustomers(polar)("customer_external_id");
console.log(customerState);
```

## Metering

The metering helper adds buffering, batching, and optional local reduction to the Polar Event Ingestion API.

### Basic usage

```typescript
import { createPolar } from "@polar-sh/sdk/{{ (ir.versions[-2] | default({})).version }}";

const polar = createPolar({ accessToken: "polar_oat_xxx" });

async function recordUsage() {
  await using metering = await polar.metering().start();
  await metering.track({
    name: "api_request",
    external_customer_id: "customer_123",
    metadata: { tokens: 42 },
  });
}
```

An event without a `timestamp` is dated when you call `track()`, not when its batch reaches Polar.

### Actor context

It's common to have several events for the same customer in the same session. You can create an actor context, so you don't have to pass the customer identifier for each event:

```typescript
await using metering = await polar.metering().start();
const actor = await metering.actor({ external_customer_id: "customer_123" });
await actor.track({ name: "api_request", metadata: { tokens: 42 } });
await actor.track({ name: "api_request", metadata: { tokens: 17 } });
```

### Read meters

The metering helper can read meters. Under the hood, it can leverage Outpost to have low-latency reads.

```typescript
const meter = await metering.meter("meter_uuid", {
  external_customer_id: "customer_123",
});
if (meter !== null) {
  console.log(meter.consumed_units, meter.credited_units, meter.balance);
}
```

With an actor context:

```typescript
const actor = await metering.actor({ external_customer_id: "customer_123" });
const meter = await actor.meter("meter_uuid");
if (meter !== null) {
  console.log(meter.consumed_units, meter.credited_units, meter.balance);
}
```

### Local reduction with Outpost

Outpost is our local reduction engine. It can reduce events locally and share a state across all your clients via Redis. Pass `outpost: true` to `polar.metering()` to enable it; it then uses the Redis at the `REDIS_URL` environment variable.

In high throughput scenarios, Outpost can return you accurate meter reads only milliseconds after the event is ingested.

Outpost needs an `external_id` on every event; `track()` rejects an event without one.

An event counts locally until Polar confirms it stored it, or until the buffer gives it up, so a meter read never loses an event Polar is still ingesting.

Pass an object instead of `true` to configure it.

### Delivery

The metering helper queues events in memory and sends them in batches of up to `batchSize`
events, or every `batchIntervalMs`. `track()` never waits for the HTTP request.

On a long-running server, let the interval deliver. Leaving the `await using` scope drains
the queue; it waits up to `shutdownTimeoutMs`.

In serverless environments such as Vercel or AWS Lambda, the process may stop when the handler
returns. Call `flush()` once per request, after the response is handed off where the platform
allows it (`after()` in Next.js, `waitUntil` on Vercel and Cloudflare). `flush()` resolves once
every event queued before it is delivered or reported to `onDropped`. Events queued by other
requests in the meantime share the same HTTP requests, so concurrent handlers don't send one
event each.

```typescript
import { after } from "next/server";

async function handleRequest() {
  await metering.track({ name: "api_request", external_customer_id: "customer_123" });
  after(() => metering.flush());
  return { ok: true };
}
```

Where no such hook exists, `await metering.flush()` before returning.

When Polar answers `429 Too Many Requests`, the helper keeps the events, waits for the
`Retry-After` delay, then sends them in full batches. A `flush()` in flight resolves after that
wait. The rate limit counts requests, not events, so batching is what keeps you under it.

### Options

#### Buffered

The metering helper buffers events in memory and sends them in batches to Polar. It retries network errors and server errors with exponential backoff and jitter. On a rate limit it waits out `Retry-After`, for up to five minutes per batch. Other Polar API errors drop the batch without retrying.

| Option | Default | Meaning |
| --- | --- | --- |
| `batchSize` | `100` | Maximum events per HTTP request. |
| `batchIntervalMs` | `1000` | Milliseconds to collect a batch, starting with its first event. |
| `shutdownTimeoutMs` | `5000` | Milliseconds allowed to drain on scope exit. |
| `maxAttempts` | `3` | Total attempts per batch, including the first. |
| `onDelivered` | `undefined` | Callback receiving the events Polar accepted; may be async.     |
| `onDropped` | `undefined` | Callback receiving the dropped events and reason; may be async. |

#### Outpost

| Option | Default | Meaning |
| --- | --- | --- |
| `redisUrl` | `REDIS_URL` environment variable | Redis instance used by Outpost. |
| `telemetry` | `true` | Send Outpost metrics and traces to Polar. |
| `snapshotTimeout` | `5000` | Milliseconds a cold read waits for its initial snapshot. |
| `confirmTimeout` | `2000` | Milliseconds a snapshot waits for Polar to confirm its events. |

Telemetry can also be disabled with the `POLAR_OUTPOST_TELEMETRY=0` environment variable.

## Webhooks

Use `webhooks.validateEvent` to verify that a webhook was sent by Polar and parse it into a typed
payload for the selected API version. Pass the raw request body, the request headers, and your
webhook signing secret:

```typescript
import express from "express";
import { webhooks } from "@polar-sh/sdk/{{ (ir.versions[-2] | default({})).version }}";

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

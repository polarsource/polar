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

## Buffered event ingestion

Use one ingestion instance for the application's lifetime. It batches events for Polar,
flushes on shutdown, and optionally updates Outpost for immediate local meter reads.

```typescript
const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

await using ingestion = await polar
    .ingestion({
        outpostRedisUrl: "redis://localhost:6379", // Omit for buffered delivery alone.
    })
    .start();

await ingestion.ingest({
    name: "tokens_used",
    external_customer_id: "customer_123",
    external_id: "usage_123",
    metadata: { tokens: 150 },
});
```

`await ingestion.ingest(event)` queues delivery to Polar and awaits any Outpost update.
It does not acknowledge delivery to Polar. Strategies run sequentially; their effects
are not atomic. Supply stable `external_id` values for retry-safe Polar delivery.
The queue is in memory and does not survive a process crash.

Use `start()` and `close()` explicitly when managing application startup and shutdown.
Closing drains buffered events within the default five-second delivery deadline.

For custom buffering or access to Outpost meter reads, compose strategies explicitly:

```typescript
import { BufferedIngestionStrategy, Ingestion } from "@polar-sh/sdk/ingestion";
import { Outpost } from "@polar-sh/sdk/outpost";
import { createPolarCore } from "@polar-sh/sdk/2026-10";

const options = { accessToken: process.env.POLAR_ACCESS_TOKEN! };
const polar = createPolar(options);
const outpost = new Outpost("redis://localhost:6379", {
    client: createPolarCore(options),
});

await using ingestion = await new Ingestion({
    strategies: [
        new BufferedIngestionStrategy(polar, {
            batchSize: 100,
            batchIntervalMs: 1_000,
            shutdownTimeoutMs: 5_000,
            maxAttempts: 3,
            onDropped: async (events, reason) => {
                console.error("Event delivery failed", { events, reason });
            },
        }),
        outpost,
    ],
}).start();

await ingestion.ingest({ name: "tokens_used", external_customer_id: "customer_123" });
const meter = await outpost.customerMeter({
    external_customer_id: "customer_123",
    meter_id: "meter_id",
});
```

Network, rate-limit, and server errors are retried with backoff, honoring `Retry-After`.
Dropped batches are logged and passed to `onDropped` with `retry_exhausted`,
`permanent_error`, or `shutdown_timeout`. A timed-out request may have reached Polar;
keep its event IDs when recovering the batch. Outpost writes are not retried.
Only applications enabling Outpost need the optional `ioredis` and `ws` packages.

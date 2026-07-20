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
import { createPolar } from "@polar-sh/sdk/2026-04";

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

## Individual API Functions

To import individual API functions for tree-shaking, create a core client and pass it to the
function:

```typescript
import { createPolarCore } from "@polar-sh/sdk/2026-04";
import { getStateExternalCustomers } from "@polar-sh/sdk/2026-04/services/customers";

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
import { webhooks } from "@polar-sh/sdk/2026-04";

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
before it is parsed. `validateEvent` throws `PolarWebhookVerificationError` for invalid signatures
and `PolarWebhookUnknownTypeError` when the event is not supported by the selected API version.
Both inherit from `PolarWebhookError`.

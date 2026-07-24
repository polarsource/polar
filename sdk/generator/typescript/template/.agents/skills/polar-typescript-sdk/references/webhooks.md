# Webhook processing

Use these instructions whenever implementing or modifying a Polar webhook receiver.

## Receiver requirements

1. Read the unmodified request body as a string or `Uint8Array`.
2. Pass the raw body, request headers, and server-side signing secret to the versioned `webhooks.validateEvent`.
3. Reject invalid signatures before parsing or processing the payload.
4. Use the `webhook-id` header as a durable deduplication key.
5. Persist or enqueue the verified event and respond with a 2xx within two seconds.
6. Make the worker idempotent because failed deliveries can be retried.
7. Choose incremental benefit-grant tracking or complete customer-state reconciliation deliberately.

## Express receiver

Use `express.raw` on the webhook route so no JSON middleware modifies the signed body. Replace `enqueueVerifiedWebhook` with a durable, idempotent application operation. Enforce uniqueness on `webhookId`; an in-memory set is not sufficient.

```typescript
import express from "express";
import { webhooks } from "@polar-sh/sdk/{{ ir.versions[0].version }}";

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error("POLAR_WEBHOOK_SECRET is required");
}

const app = express();
app.post(
  "/webhooks/polar",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const headers = {
      "webhook-id": request.header("webhook-id") ?? "",
      "webhook-timestamp": request.header("webhook-timestamp") ?? "",
      "webhook-signature": request.header("webhook-signature") ?? "",
    };

    try {
      const event = await webhooks.validateEvent(
        request.body,
        headers,
        webhookSecret,
      );
      await enqueueVerifiedWebhook({
        webhookId: headers["webhook-id"],
        event,
      });
      response.sendStatus(202);
    } catch (error) {
      if (error instanceof webhooks.PolarWebhookVerificationError) {
        response.status(403).json({ error: "Invalid webhook signature" });
        return;
      }
      if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
        console.warn("Ignoring unsupported signed Polar webhook", {
          eventType: error.eventType,
        });
        response.sendStatus(202);
        return;
      }
      if (error instanceof webhooks.PolarWebhookError) {
        response.status(400).json({ error: "Invalid webhook payload" });
        return;
      }
      throw error;
    }
  },
);
```

Acknowledging an unknown but correctly signed event avoids repeated delivery failures when the selected SDK version does not recognize a newer event type. If the application requires strict processing of every subscribed event, alert on the unknown type and upgrade deliberately.

## Track benefit grants

Use `benefit_grant.created`, `benefit_grant.updated`, and `benefit_grant.revoked` when the application maintains a local grant ledger. These events carry the grant ID, benefit ID, customer, optional member, source subscription or order, grant state, and benefit-specific properties.

- Upsert the grant by `event.data.id` on `benefit_grant.created` and `benefit_grant.updated`.
- Mark that grant revoked on `benefit_grant.revoked`.
- Correlate through `event.data.customer.external_id` when set, or a stored Polar customer ID otherwise; do not use email as the durable key.
- Derive access from whether any grant with `is_granted` and without `is_revoked` remains for the customer, member, and benefit.

Do not disable a feature merely because one grant was revoked. The same benefit can be granted through more than one subscription or order, so another active grant may still authorize access.

Use `customer.state_changed` instead when the application wants a complete current snapshot without maintaining individual grants. Compute the desired access state from `event.data.granted_benefits`, then idempotently write both enabled and disabled states. Snapshot reconciliation is also useful for repairing an incremental ledger after missed or failed processing.

Do not perform slow provisioning, network calls, or other substantial work in the receiver. Perform it in the durable worker after the verified event has been accepted.

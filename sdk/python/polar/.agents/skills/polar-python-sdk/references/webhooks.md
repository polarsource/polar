# Webhook processing

Use these instructions whenever implementing or modifying a Polar webhook receiver.

## Receiver requirements

1. Read the unmodified request body as bytes.
2. Pass the raw body, request headers, and server-side signing secret to the versioned `validate_event`.
3. Reject invalid signatures before parsing or processing the payload.
4. Use the `webhook-id` header as a durable deduplication key.
5. Persist or enqueue the verified event and respond with a 2xx within two seconds.
6. Make the worker idempotent because failed deliveries can be retried.
7. Choose incremental benefit-grant tracking or complete customer-state reconciliation deliberately.

## FastAPI receiver

Replace `enqueue_verified_webhook` with a durable, idempotent application operation. Enforce uniqueness on `webhook_id`; an in-memory set is not sufficient.

```python
import logging
import os

from fastapi import FastAPI, HTTPException, Request, Response

from polar.v2026_04.webhooks import (
    PolarWebhookError,
    PolarWebhookUnknownTypeError,
    PolarWebhookVerificationError,
    validate_event,
)

app = FastAPI()
logger = logging.getLogger(__name__)
webhook_secret = os.environ["POLAR_WEBHOOK_SECRET"]


@app.post("/webhooks/polar")
async def polar_webhook(request: Request) -> Response:
    try:
        event = validate_event(
            await request.body(),
            dict(request.headers),
            webhook_secret,
        )
    except PolarWebhookVerificationError as exc:
        raise HTTPException(
            status_code=403,
            detail="Invalid webhook signature",
        ) from exc
    except PolarWebhookUnknownTypeError as exc:
        logger.warning(
            "Ignoring unsupported signed Polar webhook",
            extra={"event_type": exc.event_type},
        )
        return Response(status_code=202)
    except PolarWebhookError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload",
        ) from exc

    await enqueue_verified_webhook(
        webhook_id=request.headers["webhook-id"],
        event=event,
    )
    return Response(status_code=202)
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

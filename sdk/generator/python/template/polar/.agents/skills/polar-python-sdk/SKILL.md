---
name: polar-python-sdk
description: Integrate Polar billing in server-side Python applications using the versioned Polar and PolarAsync clients. Use when implementing Polar customers and external IDs, checkout or customer portal sessions, customer-state entitlement checks, webhook validation and processing, API error handling, or usage-event ingestion and metered billing.
---

# Polar Python SDK

Use the generated, versioned Polar SDK without inventing methods or parameters.

## Inspect the application first

1. Identify the installed `polar-sdk` version and preserve the API version already selected by the application.
2. Inspect generated service signatures, input `TypedDict` definitions, output dataclasses, and endpoint-specific errors before writing calls.
3. Use `Polar` in synchronous code and `PolarAsync` in asynchronous code. Do not mix blocking SDK calls into an async request path.
4. Identify whether the access token is scoped to an organization. Pass `organization_id` when the selected token does not imply one, and confirm the required endpoint scopes.
5. Keep client, webhook, and environment configuration on the server.

## Configure and reuse the client

Keep production and sandbox access tokens separate. Never expose an organization access token in browser, mobile, or other public client code. Pass `environment="sandbox"` while testing; omit it or pass `environment="production"` in production.

```python
import os

from polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }} import Polar

with Polar(
    os.environ["POLAR_ACCESS_TOKEN"],
    environment="sandbox",
) as polar:
    customer_state = polar.customers.get_state_external("usr_123")
```

For a long-running service, create one client during application startup, reuse its connection pool, and close it during application shutdown. Do not create a new client for every incoming request.

Use the async client with an application-lifetime async context in async services:

```python
import os

from polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }} import PolarAsync


async def load_customer_state() -> None:
    async with PolarAsync(os.environ["POLAR_ACCESS_TOKEN"]) as polar:
        customer_state = await polar.customers.get_state_external("usr_123")
        print(customer_state)
```

## Follow generated argument and output conventions

- Pass path parameters positionally.
- Pass query and request-body parameters as keyword arguments.
- Treat request payload definitions as generated `TypedDict` schemas.
- Treat JSON object responses as generated, slotted dataclass instances or unions.
- Expect UUID and date-time OpenAPI fields to remain strings in this SDK version.
- Use `iter_*` for paginated endpoints. Use `for` with `Polar` and `async for` with `PolarAsync`; each additional page performs another API request.

## Correlate customers with stable external IDs

Use the application's immutable user or organization identifier as the Polar customer `external_id`. It is unique within a Polar organization. It may be assigned later when initially unset, but it cannot be changed or removed once set.

```python
customer = polar.customers.create(
    external_id="usr_123",
    email="user@example.com",
)
customer_state = polar.customers.get_state_external("usr_123")
```

Handle concurrent creation safely. A preflight lookup followed by creation is not atomic; if creation reports an existing email or external ID, fetch and reconcile the existing customer rather than creating a second mapping.

## Create checkout and customer portal sessions

Create checkout sessions on the server and send only the returned URL to the browser. Prefer `external_customer_id` so a completed checkout is reconciled with the application's customer.

```python
checkout = polar.checkouts.create(
    products=[os.environ["POLAR_PRODUCT_ID"]],
    external_customer_id="usr_123",
    success_url="https://example.com/billing/success?checkout_id={CHECKOUT_ID}",
    return_url="https://example.com/settings/billing",
)
redirect_to(checkout.url)
```

Do not treat the success redirect as proof of payment or entitlement. Confirm access through customer state or a verified webhook.

Create short-lived customer portal sessions only for an authenticated customer:

```python
session = polar.customer_sessions.create(
    external_customer_id="usr_123",
    return_url="https://example.com/settings/billing",
)
redirect_to(session.customer_portal_url)
```

Validate return URLs and never let an untrusted caller choose another customer's external ID.

## Reconcile feature access from customer state

Prefer a `feature_flag` benefit attached to the relevant products over inferring access from subscription statuses. Reconcile both access grants and access revocations.

```python
from polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }}.outputs import CustomerState


def has_feature_access(customer_state: CustomerState, benefit_id: str) -> bool:
    return any(
        grant.benefit_id == benefit_id
        for grant in customer_state.granted_benefits
    )


customer_state = polar.customers.get_state_external("usr_123")
set_feature_access(
    customer_external_id="usr_123",
    enabled=has_feature_access(
        customer_state,
        os.environ["POLAR_BENEFIT_ID"],
    ),
)
```

Make `set_feature_access` an idempotent application write. A missing benefit must disable access, not merely skip a grant operation.

For webhook-driven synchronization, use benefit-grant events for an incremental local grant ledger or `customer.state_changed` for complete snapshot reconciliation. Read [Webhook processing](references/webhooks.md) before implementing or modifying a receiver.

## Ingest metered usage events

Read [Usage-event ingestion](references/usage-events.md) before implementing metered billing. In particular:

- Match the event name and metadata to the configured meter.
- Associate the event with exactly one `customer_id` or `external_customer_id`.
- Assign every logical event a stable, unique `external_id`.
- Reuse the same `external_id` when retrying so Polar can deduplicate the event.
- Inspect both `inserted` and `duplicates` in the ingestion result.
- Enforce usage limits in the application; ingestion does not reject an action because a customer has exhausted a balance.

## Handle API failures intentionally

Handle generated endpoint-specific errors before broad SDK errors. Classify common base errors as follows:

- `PolarNetworkError`: retry only when the operation is safe or carries a stable deduplication identifier.
- `PolarRateLimitError`: apply bounded backoff and honor `retry_after` when present.
- `PolarServerError`: retry selected 5xx failures with bounded exponential backoff and jitter.
- `PolarClientError`: do not blindly retry authentication, authorization, validation, or not-found failures.

Never create a new usage-event `external_id` during a retry. For other mutations, use an endpoint-supported idempotency mechanism or application-level reconciliation before retrying.

# Migrate from the `<1.0.0` SDK

Use these instructions when an application depends on `polar-sdk<1.0.0` or imports `polar_sdk`. Migrate one integration boundary at a time and use the installed new SDK's generated signatures as the source of truth.

## Contents

- [Migration workflow](#migration-workflow)
- [Replace client construction](#replace-client-construction)
- [Migrate operation calls](#migrate-operation-calls)
- [Replace pagination](#replace-pagination)
- [Migrate models and errors](#migrate-models-and-errors)
- [Migrate webhook validation](#migrate-webhook-validation)

## Migration workflow

1. Inventory every `polar_sdk` import, client construction, operation call, model import, error handler, webhook receiver, retry configuration, and pagination loop.
2. Select the new API version once and use its `polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }}` namespace consistently.
3. Replace client setup before migrating operation calls.
4. Migrate request construction and response access from the generated types, not by applying broad search-and-replace rules.
5. Replace pagination, error handling, and webhook validation explicitly.
6. Remove all remaining `polar_sdk` imports and old retry or pagination helpers.

Do not run old and new clients against the same mutation as a comparison strategy. That can create duplicate customers, checkouts, orders, subscriptions, or usage events.

## Replace client construction

The old SDK exposed synchronous and `_async` operations on `polar_sdk.Polar`. The new SDK uses separate `Polar` and `PolarAsync` clients in a versioned module.

```python
# Before: polar-sdk<1.0.0
from polar_sdk import Polar

polar = Polar(access_token=access_token)
organization = await polar.organizations.get_async(organization_id)
```

```python
# After
from polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }} import PolarAsync

polar = PolarAsync(access_token)
organization = await polar.organizations.get(organization_id)
```

Use `Polar` for synchronous code and `PolarAsync` for asynchronous code. Remove `_async` suffixes after switching to `PolarAsync`. Preserve the selected environment and any organization scoping, but pass only options accepted by the new constructor.

## Migrate operation calls

- Expect shorter operation names such as `organizations.list` instead of `organizations.list_organizations`.
- Pass path parameters positionally.
- Pass query and request-body fields as keyword arguments.
- Remove old request wrapper models and per-operation request option objects unless the new signature explicitly accepts them.
- Inspect endpoint-specific errors in the selected version rather than assuming old exception names remain available.

Do not build an exhaustive static rename table. Generated operation names can differ by endpoint, and type checking against the selected version is more reliable.

The old SDK wrapped POST bodies in a `request` dictionary and often required generated enum objects. Pass body fields directly as keyword arguments in the new SDK:

```python
# Before: polar-sdk<1.0.0
import polar_sdk

checkout = polar.checkouts.create(
    request={
        "customer_name": "John Doe",
        "customer_billing_address": {
            "country": polar_sdk.AddressInputCountryAlpha2Input.US,
        },
        "locale": "en",
        "products": [product_id],
    },
)
```

```python
# After
checkout = polar.checkouts.create(
    customer_name="John Doe",
    customer_billing_address={"country": "US"},
    locale="en",
    products=[product_id],
)
```

## Replace pagination

The old SDK returned page objects advanced with `.next()`. The new SDK exposes `iter_*` helpers that yield individual resources.

```python
# Before: polar-sdk<1.0.0
page = polar.organizations.list_organizations(page=1, limit=100)
while page is not None:
    process_page(page)
    page = page.next()
```

```python
# After
for organization in polar.organizations.iter_list(limit=100):
    process_organization(organization)
```

Use `async for` with `PolarAsync`. If the application needs page metadata, call `list` directly and advance the `page` query itself; do not expect `.next()` on the response.

## Migrate models and errors

- Replace imports from `polar_sdk.models` with the selected version's `inputs`, `outputs`, `errors`, or `literals` modules only when an explicit annotation or exception type is needed.
- Replace old Pydantic model assumptions with generated input `TypedDict` definitions and output dataclasses.
- Expect UUID and date-time values to remain strings; remove code that relies on automatic conversion to `UUID` or `datetime`.
- Replace old base HTTP and network exception handling with `PolarClientError`, `PolarNetworkError`, `PolarRateLimitError`, and `PolarServerError`, then handle version-specific endpoint errors before those broad classes.
- Replace old SDK retry configuration with bounded application-level retries. Retry mutations only when the endpoint is idempotent or the application can reconcile the result.

## Migrate webhook validation

Import `validate_event` and webhook errors from `polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }}.webhooks`. Pass the unmodified request body, request headers, and signing secret.

Rename old `WebhookVerificationError`, `WebhookUnknownTypeError`, and broad webhook error handlers to their new `PolarWebhookVerificationError`, `PolarWebhookUnknownTypeError`, and `PolarWebhookError` equivalents. Preserve the behavior of acknowledging unknown but correctly signed event types.

Read [Webhook processing](webhooks.md) when changing receiver behavior, deduplication, or benefit synchronization. Read [Usage-event ingestion](usage-events.md) before migrating metered event delivery or retry logic.

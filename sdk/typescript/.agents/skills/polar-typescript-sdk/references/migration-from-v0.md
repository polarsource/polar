# Migrate from the `<1.0.0` SDK

Use these instructions when an application depends on `@polar-sh/sdk<1.0.0`, imports the unversioned `Polar` class, or uses camelCase API fields. Migrate one integration boundary at a time and use the installed new SDK's generated signatures as the source of truth.

## Contents

- [Migration workflow](#migration-workflow)
- [Keep the casing boundary explicit](#keep-the-casing-boundary-explicit)
- [Replace client construction](#replace-client-construction)
- [Migrate operation calls](#migrate-operation-calls)
- [Replace pagination](#replace-pagination)
- [Migrate errors, retries, and webhooks](#migrate-errors-retries-and-webhooks)

## Migration workflow

1. Inventory every SDK import, client construction, operation call, request object, response access, error handler, webhook receiver, retry configuration, and pagination loop.
2. Select the new API version once and use its versioned imports consistently.
3. Replace client setup before migrating operation calls.
4. Convert API request and response fields from camelCase to `snake_case`.
5. Replace pagination, error handling, and webhook validation explicitly.
6. Remove all remaining unversioned SDK imports and old retry or pagination helpers.

Do not run old and new clients against the same mutation as a comparison strategy. That can create duplicate customers, checkouts, orders, subscriptions, or usage events.

## Keep the casing boundary explicit

The old SDK automatically converted API request and response fields to camelCase. The new SDK does not perform field-name conversion:

- Keep service and operation names in camelCase, such as `customerSessions`, `getStateExternal`, and `iterList`.
- Write request, query, and response fields in API-style `snake_case`.
- Do not recursively rename arbitrary `metadata`, custom-field data, or other user-defined object keys.

```typescript
// Before: @polar-sh/sdk<1.0.0
const checkout = await polar.checkouts.create({
  products: [productId],
  externalCustomerId: "usr_123",
  successUrl,
});
console.log(checkout.customerId);
```

```typescript
// After
const checkout = await polar.checkouts.create({
  products: [productId],
  external_customer_id: "usr_123",
  success_url: successUrl,
});
console.log(checkout.customer_id);
```

Search for camelCase field access throughout application code, persistence mapping, webhook handling, and mocks. Type checking catches many request mistakes, but response values passed through `any`, JSON fixtures, and property-string access need deliberate review.

## Replace client construction

Replace the old class with the versioned `createPolar` factory:

```typescript
// Before: @polar-sh/sdk<1.0.0
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({ accessToken });
```

```typescript
// After
import { createPolar } from "@polar-sh/sdk/2026-04";

const polar = createPolar({ accessToken });
```

Use `createPolarCore` and individual functions from the selected version's `services` paths only when tree-shaking matters. Do not carry forward constructor options that are absent from `PolarOptions`.

## Migrate operation calls

- Expect normalized operation names such as `organizations.list` instead of `organizations.listOrganizations`.
- Pass path parameters positionally.
- Pass query parameters as an optional object after path parameters.
- Pass request bodies as one typed object.
- Inspect every selected service signature rather than assuming a mechanical rename.

The old standalone functions and the new service factories have different names and binding conventions. Rebuild tree-shakable imports from the selected version's `services` exports instead of renaming the old functions.

## Replace pagination

The old SDK made a list response async iterable and yielded pages. The new SDK exposes `iter*` methods that yield individual resources.

```typescript
// Before: @polar-sh/sdk<1.0.0
const pages = await polar.organizations.listOrganizations({});
for await (const page of pages) {
  processPage(page);
}
```

```typescript
// After
for await (const organization of polar.organizations.iterList()) {
  processOrganization(organization);
}
```

Call `list` directly when the application needs page metadata. Do not wrap an `iter*` call in an extra `await` before iterating it.

## Migrate errors, retries, and webhooks

- Replace old SDK error classes with `PolarClientError`, `PolarNetworkError`, `PolarRateLimitError`, and `PolarServerError`, then handle version-specific endpoint errors before those broad classes.
- Remove the old `retryConfig`; apply bounded application-level retries and honor `retryAfter` for rate limits. Retry mutations only when the endpoint is idempotent or the application can reconcile the result.
- Replace imports from `@polar-sh/sdk/webhooks` with the versioned `webhooks` namespace.
- Await `webhooks.validateEvent`, passing the unmodified request body, request headers, and signing secret.
- Rename old webhook error checks to `webhooks.PolarWebhookVerificationError`, `webhooks.PolarWebhookUnknownTypeError`, and `webhooks.PolarWebhookError`.

Preserve the behavior of acknowledging unknown but correctly signed event types. Read [Webhook processing](webhooks.md) when changing receiver behavior, deduplication, or benefit synchronization. Read [Usage-event ingestion](usage-events.md) before migrating metered event delivery or retry logic.

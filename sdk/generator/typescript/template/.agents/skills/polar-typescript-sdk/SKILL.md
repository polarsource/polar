---
name: polar-typescript-sdk
description: Integrate Polar billing in server-side TypeScript applications using the versioned createPolar and createPolarCore clients. Use when implementing Polar customers and external IDs, checkout or customer portal sessions, customer-state entitlement checks, webhook validation and processing, API error handling, tree-shakable SDK calls, usage-event ingestion and metered billing, or migrating an application from the old Polar TypeScript SDK.
---

# Polar TypeScript SDK

Use the generated, versioned Polar SDK without inventing methods or parameters.

## Inspect the application first

1. Identify the installed `@polar-sh/sdk` version and preserve the API version already selected by the application.
2. Inspect generated service signatures, model interfaces, response types, and endpoint-specific errors before writing calls.
3. Use `createPolar` for the full service client. Use `createPolarCore` with individual service functions when bundle size or tree-shaking matters.
4. Identify whether the access token is scoped to an organization. Pass `organization_id` when the selected token does not imply one, and confirm the required endpoint scopes.
5. Keep client, webhook, and environment configuration in trusted server-side code.

## Migrate from the old SDK

Read [Migration from the `<1.0.0` SDK](references/migration-from-v0.md) before changing an application that imports an unversioned `Polar` class or uses camelCase request and response fields. Do not mix old and new client, field-casing, pagination, error, or webhook conventions.

## Configure and reuse the client

Keep production and sandbox access tokens separate. Never expose an organization access token in browser, mobile, or other public client code. Pass `environment: "sandbox"` while testing; omit it or pass `environment: "production"` in production.

```typescript
import { createPolar } from "@polar-sh/sdk/{{ ir.versions[0].version }}";

const accessToken = process.env.POLAR_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("POLAR_ACCESS_TOKEN is required");
}

const polar = createPolar({
  accessToken,
  environment: "sandbox",
});

const customerState = await polar.customers.getStateExternal("usr_123");
```

Create the client once for a long-running server and reuse it. The TypeScript client uses `fetch` and does not expose a connection-closing lifecycle.

For tree-shakable individual functions, create a core client and bind only the operations the application uses:

```typescript
import { createPolarCore } from "@polar-sh/sdk/{{ ir.versions[0].version }}";
import { getStateExternalCustomers } from "@polar-sh/sdk/{{ ir.versions[0].version }}/services/customers";

const polarCore = createPolarCore({ accessToken });
const getCustomerState = getStateExternalCustomers(polarCore);
const customerState = await getCustomerState("usr_123");
```

## Follow generated argument and output conventions

- Use camelCase service names and methods such as `benefitGrants`, `getStateExternal`, and `iterList`.
- Keep request, query, and response field names in API-style `snake_case`, such as `external_customer_id`.
- Pass path parameters positionally.
- Pass query parameters as an optional object after path parameters.
- Pass request bodies as a single typed object.
- Treat responses as typed plain JavaScript objects.
- Expect UUID and date-time OpenAPI fields to remain strings.
- Consume paginated `iter*` methods with `for await`; each additional page performs another API request.

```typescript
for await (const customer of polar.customers.iterList({
  sorting: ["email"],
})) {
  console.log(customer.id);
}
```

## Correlate customers with stable external IDs

Use the application's immutable user or organization identifier as the Polar customer `external_id`. It is unique within a Polar organization. It may be assigned later when initially unset, but it cannot be changed or removed once set.

```typescript
const customer = await polar.customers.create({
  external_id: "usr_123",
  email: "user@example.com",
});
const customerState = await polar.customers.getStateExternal("usr_123");
```

Handle concurrent creation safely. A preflight lookup followed by creation is not atomic; if creation reports an existing email or external ID, fetch and reconcile the existing customer rather than creating a second mapping.

## Create checkout and customer portal sessions

Create checkout sessions on the server and send only the returned URL to the browser. Prefer `external_customer_id` so a completed checkout is reconciled with the application's customer.

```typescript
const productId = process.env.POLAR_PRODUCT_ID;
if (!productId) {
  throw new Error("POLAR_PRODUCT_ID is required");
}

const checkout = await polar.checkouts.create({
  products: [productId],
  external_customer_id: "usr_123",
  success_url: "https://example.com/billing/success?checkout_id={CHECKOUT_ID}",
  return_url: "https://example.com/settings/billing",
});
redirect(checkout.url);
```

Do not treat the success redirect as proof of payment or entitlement. Confirm access through customer state or a verified webhook.

Create short-lived customer portal sessions only for an authenticated customer:

```typescript
const session = await polar.customerSessions.create({
  external_customer_id: "usr_123",
  return_url: "https://example.com/settings/billing",
});
redirect(session.customer_portal_url);
```

Validate return URLs and never let an untrusted caller choose another customer's external ID.

## Reconcile feature access from customer state

Prefer a `feature_flag` benefit attached to the relevant products over inferring access from subscription statuses. Reconcile both access grants and access revocations.

```typescript
const benefitId = process.env.POLAR_BENEFIT_ID;
if (!benefitId) {
  throw new Error("POLAR_BENEFIT_ID is required");
}

const customerState = await polar.customers.getStateExternal("usr_123");
const enabled = customerState.granted_benefits.some(
  (grant) => grant.benefit_id === benefitId,
);

await setFeatureAccess({
  customerExternalId: "usr_123",
  enabled,
});
```

Make `setFeatureAccess` an idempotent application write. A missing benefit must disable access, not merely skip a grant operation.

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

Handle generated endpoint-specific errors before broad SDK errors. Import base errors from `@polar-sh/sdk` and version-specific endpoint errors from the selected API version's `errors` namespace.

- `PolarNetworkError`: retry only when the operation is safe or carries a stable deduplication identifier.
- `PolarRateLimitError`: apply bounded backoff and honor `retryAfter` when present.
- `PolarServerError`: retry selected 5xx failures with bounded exponential backoff and jitter.
- `PolarClientError`: do not blindly retry authentication, authorization, validation, or not-found failures.

Never create a new usage-event `external_id` during a retry. For other mutations, use an endpoint-supported idempotency mechanism or application-level reconciliation before retrying.

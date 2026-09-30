# @polar-sh/nuxt

Payments and Checkouts made dead simple with Nuxt.

## Installation

### Install the package

Choose your preferred package manager to install the module:

`pnpm add @polar-sh/nuxt zod`

The module requires Nuxt 4 and Node.js 22 or later.

### Register the module

Add the module to your `nuxt.config.ts`, along with the runtime config the handlers below read from:

```typescript
export default defineNuxtConfig({
  modules: ['@polar-sh/nuxt'],
  runtimeConfig: {
    private: {
      polarAccessToken: '', // NUXT_PRIVATE_POLAR_ACCESS_TOKEN
      polarServer: '', // NUXT_PRIVATE_POLAR_SERVER - "sandbox" or "production"
      polarCheckoutSuccessUrl: '', // NUXT_PRIVATE_POLAR_CHECKOUT_SUCCESS_URL
      polarWebhookSecret: '', // NUXT_PRIVATE_POLAR_WEBHOOK_SECRET
    },
  },
})
```

The module auto-imports `Checkout`, `CustomerPortal` and `Webhooks` in your `server/` code.

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// server/routes/api/checkout.get.ts
export default defineEventHandler((event) => {
  const {
    private: { polarAccessToken, polarCheckoutSuccessUrl, polarServer },
  } = useRuntimeConfig()

  const checkoutHandler = Checkout({
    accessToken: polarAccessToken,
    successUrl: polarCheckoutSuccessUrl,
    returnUrl: 'https://myapp.com', // Optional Return URL, which renders a Back-button in the Checkout
    environment: polarServer as 'sandbox' | 'production',
    theme: 'dark', // Enforces the theme - System-preferred theme will be set if left omitted
  })

  return checkoutHandler(event)
})
```

### Query Params

Pass query params to this route.

- products `?products=123` - Separate multiple products with commas: `?products=123,456`
- customer_id (optional) `?products=123&customer_id=xxx`
- external_customer_id (optional) `?products=123&external_customer_id=xxx`
- customer_email (optional) `?products=123&customer_email=janedoe@gmail.com`
- customer_name (optional) `?products=123&customer_name=Jane`
- discount_code (optional) `?products=123&discount_code=SAVE20` - Apply a discount code before redirecting. Discount codes must be enabled; `discount_id` takes precedence when both are supplied.
- seats (optional) `?products=123&seats=5` - Number of seats for seat-based products
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
// server/routes/api/portal.get.ts
export default defineEventHandler((event) => {
  const {
    private: { polarAccessToken, polarServer },
  } = useRuntimeConfig()

  const customerPortalHandler = CustomerPortal({
    accessToken: polarAccessToken,
    environment: polarServer as 'sandbox' | 'production',
    getCustomerId: (event) => {
      // Use your own logic to get the Polar customer ID - from a database, session, etc.
      return Promise.resolve('9d89909b-216d-475e-8005-053dba7cff07')
    },
    returnUrl: 'https://myapp.com', // Optional Return URL, which renders a Back-button in the Customer Portal
  })

  return customerPortalHandler(event)
})
```

## Webhooks

A simple utility which resolves incoming webhook payloads by verifying their signature with your webhook secret.

```typescript
// server/routes/webhook/polar.post.ts
export default defineEventHandler((event) => {
  const {
    private: { polarWebhookSecret },
  } = useRuntimeConfig()

  const webhooksHandler = Webhooks({
    webhookSecret: polarWebhookSecret,
    onPayload: async (payload) => {
      // Handle the payload
      // No need to return an acknowledge response
    },
  })

  return webhooksHandler(event)
})
```

### Payload Handlers

The Webhook handler also supports granular handlers for easy integration.

- onPayload: (payload) => - Called for every event, in addition to the matching handler below
- onCheckoutCreated: (payload) =>
- onCheckoutExpired: (payload) =>
- onCheckoutUpdated: (payload) =>
- onOrderCreated: (payload) =>
- onOrderUpdated: (payload) =>
- onOrderPaid: (payload) =>
- onOrderRefunded: (payload) =>
- onRefundCreated: (payload) =>
- onRefundUpdated: (payload) =>
- onSubscriptionCreated: (payload) =>
- onSubscriptionUpdated: (payload) =>
- onSubscriptionActive: (payload) =>
- onSubscriptionCanceled: (payload) =>
- onSubscriptionCycled: (payload) =>
- onSubscriptionPastDue: (payload) =>
- onSubscriptionPaused: (payload) =>
- onSubscriptionResumed: (payload) =>
- onSubscriptionRevoked: (payload) =>
- onSubscriptionUncanceled: (payload) =>
- onProductCreated: (payload) =>
- onProductUpdated: (payload) =>
- onOrganizationUpdated: (payload) =>
- onBenefitCreated: (payload) =>
- onBenefitUpdated: (payload) =>
- onBenefitGrantCreated: (payload) =>
- onBenefitGrantCycled: (payload) =>
- onBenefitGrantUpdated: (payload) =>
- onBenefitGrantRevoked: (payload) =>
- onCustomerCreated: (payload) =>
- onCustomerUpdated: (payload) =>
- onCustomerDeleted: (payload) =>
- onCustomerStateChanged: (payload) =>
- onCustomerSeatAssigned: (payload) =>
- onCustomerSeatClaimed: (payload) =>
- onCustomerSeatRevoked: (payload) =>
- onDiscountCreated: (payload) =>
- onDiscountUpdated: (payload) =>
- onDiscountDeleted: (payload) =>
- onMemberCreated: (payload) =>
- onMemberUpdated: (payload) =>
- onMemberDeleted: (payload) =>

Handlers are `async` functions. Webhook payloads use the generated SDK's snake_case fields. Signed events unknown to the installed SDK version are acknowledged and ignored so newly introduced event types do not cause retries.

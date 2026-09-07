# @polar-sh/nuxt

Payments and Checkouts made dead simple with Nuxt.

## Installation

### Install the package

Choose your preferred package manager to install the module:

`pnpm add @polar-sh/nuxt`

### Register the module

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@polar-sh/nuxt'],
})
```

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// server/routes/api/checkout.post.ts
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

- products `?products=123`
- customer_id (optional) `?products=123&customer_id=xxx`
- external_customer_id (optional) `?products=123&external_customer_id=xxx`
- customer_email (optional) `?products=123&customer_email=janedoe@gmail.com`
- customer_name (optional) `?products=123&customer_name=Jane`
- discount_code (optional) `?products=123&discount_code=SAVE20` - Apply a discount code before redirecting. Discount codes must be enabled; `discount_id` takes precedence when both are supplied.
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
// server/routes/api/portal.get.ts
export default defineEventHandler((event) => {
  const {
    private: { polarAccessToken, polarCheckoutSuccessUrl, polarServer },
  } = useRuntimeConfig()

  const customerPortalHandler = CustomerPortal({
    accessToken: polarAccessToken,
    environment: polarServer as 'sandbox' | 'production',
    getCustomerId: (event) => {
      return Promise.resolve('9d89909b-216d-475e-8005-053dba7cff07')
    },
    returnUrl: 'https://myapp.com', // Optional Return URL, which renders a Back-button in the Customer Portal
  })

  return customerPortalHandler(event)
})
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
// server/routes/webhook/polar.post.ts
export default defineEventHandler((event) => {
  const {
    private: { polarWebhookSecret },
  } = useRuntimeConfig()

  const webhooksHandler = Webhooks({
    webhookSecret: polarWebhookSecret,
    onPayload: async (payload: any) => {
      // Handle the payload
      // No need to return an acknowledge response
    },
  })

  return webhooksHandler(event)
})
```

### Payload Handlers

The Webhook handler also supports granular handlers for easy integration.

- onCheckoutCreated: (payload) =>
- onCheckoutUpdated: (payload) =>
- onOrderCreated: (payload) =>
- onOrderUpdated: (payload) =>
- onOrderPaid: (payload) =>
- onSubscriptionCreated: (payload) =>
- onSubscriptionUpdated: (payload) =>
- onSubscriptionActive: (payload) =>
- onSubscriptionCanceled: (payload) =>
- onSubscriptionRevoked: (payload) =>
- onProductCreated: (payload) =>
- onProductUpdated: (payload) =>
- onOrganizationUpdated: (payload) =>
- onBenefitCreated: (payload) =>
- onBenefitUpdated: (payload) =>
- onBenefitGrantCreated: (payload) =>
- onBenefitGrantUpdated: (payload) =>
- onBenefitGrantRevoked: (payload) =>
- onCustomerCreated: (payload) =>
- onCustomerUpdated: (payload) =>
- onCustomerDeleted: (payload) =>
- onCustomerStateChanged: (payload) =>

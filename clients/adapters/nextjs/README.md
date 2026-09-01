# @polar-sh/nextjs

Payments and Checkouts made dead simple with Next.js.

`pnpm install @polar-sh/nextjs zod`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// checkout/route.ts
import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	successUrl: process.env.SUCCESS_URL,
    returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Checkout
	server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
	theme: "dark" // Enforces the theme - System-preferred theme will be set if left omitted
});
```

### Query Params

Pass query params to this route.

- products `?products=123`
- customerId (optional) `?products=123&customerId=xxx`
- customerExternalId (optional) `?products=123&customerExternalId=xxx`
- customerEmail (optional) `?products=123&customerEmail=janedoe@gmail.com`
- customerName (optional) `?products=123&customerName=Jane`
- seats (optional) `?products=123&seats=5` - Number of seats for seat-based products
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
// portal/route.ts
import { CustomerPortal } from "@polar-sh/nextjs";

export const GET = CustomerPortal({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	getCustomerId: (req: NextRequest) => "", // Fuction to resolve a Polar Customer ID
    returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Customer Portal
	server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
// api/webhook/polar/route.ts
import { Webhooks } from "@polar-sh/nextjs";

export const POST = Webhooks({
	webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
	onPayload: async (payload) => {
		// Handle the payload
		// No need to return an acknowledge response
	},
});
```

#### Payload Handlers

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

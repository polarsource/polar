# Seat-Based Pricing Example

This is a complete Next.js example demonstrating how to implement seat-based pricing using the [Polar SDK](https://github.com/polarsource/polar). All examples are based on the official [Seat-Based Pricing Guide](https://docs.polar.sh/guides/seat-based-pricing).

## Features

This example includes working code for:

- **Creating seat-based products** - Both subscription and one-time purchase models
- **Checkout flow** - Allow customers to select seat quantities
- **Seat management** - Assign, list, and revoke seats
- **Claim flow** - Let team members claim their seats
- **Webhook handlers** - React to subscription, order, and benefit events
- **Scaling** - Add or reduce seats for subscriptions

## Prerequisites

Before running this example, you need:

1. A Polar organization with the `seat_based_pricing_enabled` feature flag
   - Contact Polar support to enable this feature
2. A Polar access token with appropriate permissions
3. Node.js 18+ and pnpm installed

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
POLAR_ACCESS_TOKEN=your_polar_access_token_here
POLAR_ORGANIZATION_ID=your_organization_id_here
POLAR_WEBHOOK_SECRET=your_webhook_secret_here  # Optional, for webhook verification
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the example.

## Project Structure

```
├── app/
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Home page with navigation
│   ├── globals.css                     # Global styles
│   └── examples/
│       ├── create-product/page.tsx     # Product creation examples
│       ├── checkout/page.tsx           # Checkout flow examples
│       ├── seat-management/page.tsx    # Seat management examples
│       ├── claim/page.tsx              # Seat claim flow examples
│       ├── webhooks/page.tsx           # Webhook handler examples
│       └── scaling/page.tsx            # Scaling seats examples
├── lib/
│   └── polar.ts                        # Polar SDK configuration
├── .env.example                        # Environment variables template
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript configuration
└── README.md                           # This file
```

## Examples Overview

### 1. Create Seat-Based Product

Located in `/examples/create-product`, this shows:

- Creating subscription products with seat-based pricing
- Creating one-time purchase products with seat-based pricing
- Configuring volume-based pricing tiers
- Setting minimum seat requirements

**Key Code:**
```typescript
const product = await polar.products.create({
  name: "Team Pro Plan",
  organization_id: "org_123",
  is_recurring: true,
  prices: [{
    type: "recurring",
    recurring_interval: "month",
    amount_type: "seat_based",
    price_currency: "usd",
    seat_tiers: [
      { min_seats: 1, max_seats: 4, price_per_seat: 1000 },
      { min_seats: 5, max_seats: 9, price_per_seat: 900 },
      { min_seats: 10, max_seats: null, price_per_seat: 800 }
    ]
  }]
});
```

### 2. Checkout Flow

Located in `/examples/checkout`, this demonstrates:

- Creating checkouts with seat quantity selection
- API route implementation for checkout creation
- Frontend form for seat purchase
- Automatic tier-based pricing calculation

**Key Code:**
```typescript
const checkout = await polar.checkouts.create({
  product_price_id: "price_123",
  seats: 5,
  success_url: "https://yourapp.com/success",
  customer_email: "billing@company.com"
});
```

### 3. Seat Management

Located in `/examples/seat-management`, this shows:

- Listing available and claimed seats
- Assigning seats to team members
- Revoking seats
- Using metadata for seat assignments
- Complete React component for seat management UI

**Key Code:**
```typescript
// List seats
const { seats, available_seats, total_seats } =
  await polar.customerSeats.list({ subscription_id: "sub_123" });

// Assign a seat
const seat = await polar.customerSeats.assign({
  subscription_id: "sub_123",
  email: "dev@company.com",
  metadata: { department: "Engineering" }
});

// Revoke a seat
await polar.customerSeats.revoke({ seat_id: "seat_456" });
```

### 4. Seat Claim Flow

Located in `/examples/claim`, this demonstrates:

- Retrieving claim information from invitation token
- Processing seat claims
- Receiving customer session tokens
- Complete claim page implementation
- Error handling for expired/invalid tokens

**Key Code:**
```typescript
// Get claim info
const claimInfo = await polar.customerSeats.getClaimInfo({
  invitation_token: token
});

// Claim the seat
const { seat, customer_session_token } = await polar.customerSeats.claim({
  invitation_token: token
});
```

### 5. Webhook Handlers

Located in `/examples/webhooks`, this shows:

- Handling subscription and order creation events
- Processing benefit grant and revocation events
- Webhook signature verification
- Complete webhook handler implementation
- Best practices for webhook processing

**Key Code:**
```typescript
// Handle subscription created
if (event.type === 'subscription.created') {
  const subscription = event.data;
  if (subscription.product.has_seat_based_price) {
    await notifyBillingManager(subscription);
  }
}

// Handle benefit granted
if (event.type === 'benefit_grant.created') {
  const grant = event.data;
  await grantAccess(grant.customer_id, grant.benefit);
}
```

### 6. Scaling Seats

Located in `/examples/scaling`, this demonstrates:

- Adding seats to subscriptions
- Reducing seats (with validation)
- Purchasing additional seats for one-time products
- Bulk seat assignment
- Utilization tracking
- React component for seat scaling UI

**Key Code:**
```typescript
// Add seats (subscription)
const subscription = await polar.subscriptions.update({
  id: subscriptionId,
  seats: newTotal
});

// Purchase more seats (one-time)
const checkout = await polar.checkouts.create({
  product_id: productId,
  seats: additionalSeats,
  success_url: "https://yourapp.com/success"
});
```

## Key Concepts

### Subscription vs One-Time Products

- **Subscriptions**: Recurring billing with ability to scale seats up/down
- **One-Time**: Perpetual licenses, each order has independent seat pool

### Seat States

- **Pending**: Seat assigned but not yet claimed by team member
- **Claimed**: Team member has claimed the seat and received benefits
- **Revoked**: Seat has been revoked and benefits removed

### Pricing Tiers

Volume-based discounts automatically applied:
- 1-4 seats: $10/seat
- 5-9 seats: $9/seat
- 10+ seats: $8/seat

A team purchasing 6 seats pays: `6 × $9 = $54`

## API Routes (To Implement)

This example shows the client-side code. For a complete implementation, you would need to create these API routes:

- `POST /api/checkout` - Create checkout sessions
- `GET /api/seats?subscriptionId=...` - List seats
- `POST /api/seats/assign` - Assign a seat
- `POST /api/seats/revoke` - Revoke a seat
- `GET /api/claim/info?token=...` - Get claim information
- `POST /api/claim` - Process seat claim
- `POST /api/webhooks/polar` - Handle Polar webhooks
- `POST /api/subscriptions/update-seats` - Update seat count

## Testing Webhooks Locally

To test webhooks during development:

1. Start your dev server: `pnpm dev`
2. Use ngrok to expose your local server:
   ```bash
   ngrok http 3000
   ```
3. Configure the webhook URL in your Polar dashboard:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/polar
   ```

## Building for Production

```bash
pnpm build
pnpm start
```

## Learn More

- [Polar Documentation](https://docs.polar.sh)
- [Seat-Based Pricing Guide](https://docs.polar.sh/guides/seat-based-pricing)
- [Polar SDK](https://github.com/polarsource/polar)
- [Customer Seats API Reference](https://docs.polar.sh/api-reference/customer-seats)

## Support

- [Discord Community](https://polar.sh/discord)
- [GitHub Issues](https://github.com/polarsource/polar/issues)

## License

This example is provided as-is for educational purposes.

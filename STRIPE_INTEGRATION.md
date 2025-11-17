# Polar Stripe Integration Analysis

## Overview
Polar uses **Stripe** as its primary payment provider for processing payments, managing subscriptions, handling refunds, and managing payouts. Stripe is deeply integrated throughout the platform.

---

## 1. Stripe Configuration & Environment Variables

### Required Configuration

The following environment variables **must** be set in `.env`:

```bash
POLAR_STRIPE_SECRET_KEY="sk_..."                 # Stripe Secret API Key (required)
POLAR_STRIPE_PUBLISHABLE_KEY="pk_..."            # Stripe Publishable Key (required)
POLAR_STRIPE_WEBHOOK_SECRET="whsec_..."          # Webhook signing secret for direct events
POLAR_STRIPE_CONNECT_WEBHOOK_SECRET="whsec_..."  # Webhook signing secret for Connect events
```

**Reference:** `/home/user/flowpay/server/polar/config.py` (lines 184-188)

### Configuration Details

- **API Key Setup**: Set in `/home/user/flowpay/server/polar/config.py` as Settings class fields
- **Usage in Code**: 
  - Service initialization: `/home/user/flowpay/server/polar/integrations/stripe/service.py` (line 20)
  - Endpoints: `/home/user/flowpay/server/polar/integrations/stripe/endpoints.py` (line 14)

---

## 2. Stripe Entities Created

### 2.1 Stripe Customers
**Database Reference:** `customers.stripe_customer_id` and `users.stripe_customer_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/customer.py`
- Model: `/home/user/flowpay/server/polar/models/user.py`

**Creation Flow:**
1. When a customer is created or checkout is confirmed, if `stripe_customer_id` is `NULL`
2. Stripe Customer created via: `stripe_service.create_customer(**params)`
3. **Location:** `/home/user/flowpay/server/polar/checkout/service.py` (lines 2034-2047)

**Customer Data Synced to Stripe:**
- Email address
- Name (billing or customer name)
- Billing address
- Tax ID (VAT/GST information)

**Example Creation Code:**
```python
stripe_customer = await stripe_service.create_customer(
    email=customer.email,
    name=customer.name,
    address=customer.billing_address.to_dict(),
    tax_id_data=[to_stripe_tax_id(customer.tax_id)]
)
customer.stripe_customer_id = stripe_customer.id
```

### 2.2 Stripe Products & Prices
**Database Reference:** `products.stripe_product_id`, `product_prices.stripe_price_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/product.py`
- Model: `/home/user/flowpay/server/polar/models/product_price.py`

**Creation Flow:**
1. When a Polar Product is created
2. Stripe Product created: `stripe_service.create_product(name, description, metadata)`
3. For each ProductPrice, create Stripe Price: `stripe_service.create_price_for_product(...)`
4. **Location:** `/home/user/flowpay/server/polar/product/service.py` (lines 250-263)

**Metadata Included:**
- `product_id`: Polar Product UUID
- `organization_id`: Organization UUID
- `organization_name`: Organization slug
- `product_price_id`: Polar ProductPrice UUID (on prices)

**Product Types:**
- **One-time purchases**
- **Recurring subscriptions** (with interval: day, month, year)

### 2.3 Stripe Invoices
**Database Reference:** `orders.stripe_invoice_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/order.py` (line 118)

**Creation Flow:**
1. For out-of-band subscriptions (send_invoice collection method)
2. Created in: `stripe_service.create_out_of_band_subscription()` or `stripe_service.create_out_of_band_invoice()`
3. **Location:** `/home/user/flowpay/server/polar/integrations/stripe/service.py` (lines 822-898)

**Invoice Status Flow:**
- Draft → Finalized → Open → Paid (out-of-band)

### 2.4 Stripe Subscriptions
**Database Reference:** `subscriptions.stripe_subscription_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/subscription.py` (line 113)

**Creation Flow:**
1. When a customer purchases a recurring product
2. Out-of-band subscription created: `stripe_service.create_out_of_band_subscription(...)`
3. **Location:** `/home/user/flowpay/server/polar/checkout/service.py` and order/subscription services

**Subscription Configuration:**
- `collection_method`: "send_invoice" (out-of-band) or "charge_automatically"
- `currency`: Matches checkout currency
- `items`: Array of prices with quantity 1
- `automatic_tax`: Enabled by default
- `discounts`: Coupon support

### 2.5 Stripe Charges & Payment Intents
**Database Reference:** `payments.processor_id`, `orders.checkout_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/payment.py`

**Creation Flow:**
1. Payment Intent created during checkout
2. Customer session created for embedded payment form: `stripe_service.create_customer_session(customer_id)`
3. **Location:** `/home/user/flowpay/server/polar/checkout/service.py`

### 2.6 Stripe Accounts (for payouts)
**Database Reference:** `accounts.stripe_id`

**Files:**
- Model: `/home/user/flowpay/server/polar/models/account.py` (line 51)

**Creation Flow:**
1. When organization enables Stripe Connect for payouts
2. Express Account created: `stripe_service.create_account(account_params)`
3. Account Link for onboarding: `stripe_service.create_account_link(stripe_id, return_path)`
4. **Location:** `/home/user/flowpay/server/polar/integrations/stripe/service.py` (lines 72-148)

---

## 3. Checkout & Payment Flow

### 3.1 Checkout Session Flow

**Files:** `/home/user/flowpay/server/polar/checkout/service.py`

1. **Create Checkout**
   - Stores checkout configuration (products, prices, discounts, etc.)
   - Status: `open`

2. **Confirm Checkout**
   - Customer enters billing details
   - Stripe Customer created/updated
   - Payment Intent created (for one-time purchases)
   - Setup Intent created (for recurring/subscription)
   - Checkout status: `confirmed`

3. **Payment Processing**
   - One-time: Use Stripe Payment Intent
   - Recurring: Create out-of-band invoice + subscription
   - Automatic tax calculation via Stripe Tax API

4. **Success/Failure**
   - Webhook received from Stripe
   - Order created with status `paid` or `pending`
   - Subscriptions updated with Stripe metadata
   - Checkout status: `succeeded` or `failed`

### 3.2 Subscription Lifecycle

**Files:** `/home/user/flowpay/server/polar/subscription/service.py`

1. **Creation**
   - Out-of-band subscription created in Stripe
   - Invoice generated and paid
   - Subscription status: `active` or `trialing`

2. **Billing Cycles**
   - Invoices created automatically by Stripe
   - Orders created in Polar for tracking

3. **Updates**
   - Price changes trigger subscription update
   - Prorations handled by Stripe
   - New invoices generated

4. **Cancellation**
   - Subscription set to `cancel_at_period_end=true` (soft cancel)
   - Or immediately cancelled via `Subscription.cancel_async()`
   - Webhook: `customer.subscription.deleted`

---

## 4. Webhook Handlers

### 4.1 Direct Webhooks (Standard Payments)
**Location:** `/home/user/flowpay/server/polar/integrations/stripe/endpoints.py` (lines 21-40)

Webhook types handled:
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `setup_intent.succeeded` - Setup for recurring completed
- `setup_intent.setup_failed` - Setup failed
- `charge.pending` - Charge pending
- `charge.failed` - Charge failed
- `charge.succeeded` - Charge completed
- `charge.dispute.closed` - Dispute closed
- `refund.created` - Refund created
- `refund.updated` - Refund updated
- `refund.failed` - Refund failed
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription ended
- `invoice.created` - Invoice created
- `invoice.paid` - Invoice paid
- `identity.verification_session.*` - Identity verification

**Webhook Endpoint:** `POST /v1/integrations/stripe/webhook`

### 4.2 Connect Webhooks (Payouts)
**Location:** `/home/user/flowpay/server/polar/integrations/stripe/endpoints.py` (line 41)

Webhook types handled:
- `account.updated` - Account details changed
- `payout.updated` - Payout status changed
- `payout.paid` - Payout completed

**Webhook Endpoint:** `POST /v1/integrations/stripe/webhook-connect`

### 4.3 Webhook Processing
**Files:** `/home/user/flowpay/server/polar/integrations/stripe/tasks.py`

Each webhook event:
1. **Received & Validated** at endpoints.py
2. **Enqueued** as background job in external event queue
3. **Processed** by Dramatiq actor (task handler)
4. **Marked as Handled** once complete or retried on failure

**Key Handlers:**
- `payment_intent_succeeded()` - Update orders/subscriptions
- `charge_succeeded()` - Create payment records
- `customer_subscription_updated()` - Update subscription status
- `refund_created()` - Create refund records
- `charge_dispute_closed()` - Record disputes

---

## 5. Order & Payment Tracking

### 5.1 Order Entity
**Model:** `/home/user/flowpay/server/polar/models/order.py`

**Fields:**
- `stripe_invoice_id` - Links to Stripe invoice (unique)
- `customer_id` - Customer who made purchase
- `subscription_id` - Associated subscription (if recurring)
- `checkout_id` - Associated checkout (if from checkout)
- `amount` - Total amount in cents
- `tax_amount` - Tax amount in cents
- `currency` - 3-letter currency code
- `status` - pending, paid, refunded, partially_refunded
- `billing_reason` - purchase, subscription_create, subscription_cycle, subscription_update

### 5.2 Payment Entity
**Model:** `/home/user/flowpay/server/polar/models/payment.py`

**Fields:**
- `processor` - Payment processor (Stripe)
- `processor_id` - Stripe charge/intent ID (unique)
- `status` - pending, succeeded, failed
- `amount` - Amount in cents
- `method` - Payment method type (card, etc.)
- `processor_metadata` - Raw Stripe data

---

## 6. Metadata & Linking Strategy

### 6.1 Intent Metadata (Payment/Setup Intent)
Metadata stored on Stripe objects for tracking:
```python
{
    "checkout_id": "<uuid>",      # Links to Polar Checkout
    "order_id": "<uuid>",         # Links to Polar Order (for retries)
    "wallet_id": "<uuid>",        # Links to customer wallet (optional)
    "wallet_transaction_id": "<uuid>"  # Wallet transaction (optional)
}
```

### 6.2 Invoice/Subscription Metadata
```python
{
    "type": "pledge",             # Legacy pledge payment
    "product_id": "<uuid>",       # Links to Polar Product
    "organization_id": "<uuid>",  # Organization
    "organization_name": "<slug>" # Org slug
}
```

---

## 7. Tax Integration

**Files:** `/home/user/flowpay/server/polar/checkout/service.py`

- **Stripe Tax API** used for automatic tax calculation
- Retrieves tax rate based on:
  - Customer billing address (country/state)
  - Customer tax ID (VAT/GST)
  - Product tax code
- Tax transactions recorded for compliance

---

## 8. Key Files & Locations

| Component | Location |
|-----------|----------|
| **Configuration** | `/home/user/flowpay/server/polar/config.py` |
| **Service** | `/home/user/flowpay/server/polar/integrations/stripe/service.py` |
| **Endpoints** | `/home/user/flowpay/server/polar/integrations/stripe/endpoints.py` |
| **Tasks/Webhooks** | `/home/user/flowpay/server/polar/integrations/stripe/tasks.py` |
| **Payment Handlers** | `/home/user/flowpay/server/polar/integrations/stripe/payment.py` |
| **Checkout** | `/home/user/flowpay/server/polar/checkout/service.py` |
| **Order Management** | `/home/user/flowpay/server/polar/order/service.py` |
| **Subscription** | `/home/user/flowpay/server/polar/subscription/service.py` |
| **Models** | `/home/user/flowpay/server/polar/models/` |

---

## 9. AgentPay Integration Requirements

For AgentPay to work with the payment system, you need:

### 9.1 API Keys Setup
1. Get Stripe Secret Key from Stripe Dashboard
2. Get Stripe Publishable Key from Stripe Dashboard
3. Get Webhook Signing Secret (create in Stripe Dashboard)
4. Get Connect Webhook Secret (for Stripe Connect)

### 9.2 Webhook Configuration
1. Add webhook endpoints in Stripe Dashboard:
   - `https://<domain>/v1/integrations/stripe/webhook` (with STRIPE_WEBHOOK_SECRET)
   - `https://<domain>/v1/integrations/stripe/webhook-connect` (with STRIPE_CONNECT_WEBHOOK_SECRET)

### 9.3 Database Setup
1. Products table - stores stripe_product_id
2. Product Prices table - stores stripe_price_id
3. Orders table - tracks payments via stripe_invoice_id
4. Customers table - stores stripe_customer_id
5. Subscriptions table - stores stripe_subscription_id
6. Payments table - records all Stripe charges

### 9.4 Flow Implementation
1. **Create Product** → Creates Stripe Product & Prices
2. **Checkout Session** → Creates Stripe Customer & Payment Intent
3. **Payment** → Charge via Stripe, webhook confirms → Order marked `paid`
4. **Subscription** → Creates Stripe Subscription & Invoice, auto-renews
5. **Refund** → Creates Stripe Refund, webhook updates Order

---

## 10. Testing & Development

### 10.1 Test Mode
- Use `sk_test_*` keys for development
- Stripe Test Clock support via `POLAR_USE_TEST_CLOCK` setting
- Test webhook events via Stripe Dashboard

### 10.2 Test Fixtures
- File: `/home/user/flowpay/server/tests/fixtures/stripe.py`
- Provides mock Stripe objects for unit tests

---

## Summary

Polar uses Stripe as its complete payment infrastructure:
- **Customers** managed in Stripe with metadata links to Polar
- **Products & Prices** synced to Stripe with full metadata
- **Invoices** created in Stripe for tracking
- **Subscriptions** managed by Stripe for recurring billing
- **Webhooks** handle real-time updates from Stripe
- **Payouts** via Stripe Connect with Express Accounts
- **Tax** calculated via Stripe Tax API

For AgentPay to function, ensure all 4 Stripe environment variables are set and webhook endpoints are configured in Stripe Dashboard.

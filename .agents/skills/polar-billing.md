# Polar Billing System

Comprehensive guide to Polar's billing infrastructure, covering entities, flows, Stripe integration, and benefit provisioning.

## Quick Reference

```
Checkout → Payment → Order → Transaction → Benefits
                         ↓
                   Subscription (if recurring)
                         ↓
                   Subscription Cycle → Order → ...
```

## Table of Contents

1. [Core Entities](#1-core-entities)
2. [Entity Relationships](#2-entity-relationships)
3. [Main Services](#3-main-services)
4. [Dramatiq Background Tasks](#4-dramatiq-background-tasks)
5. [Stripe Integration](#5-stripe-integration)
6. [Subscription Lifecycle](#6-subscription-lifecycle)
7. [Proration System](#7-proration-system)
8. [Benefits & Credits](#8-benefits--credits)
9. [Dunning & Payment Retry](#9-dunning--payment-retry)
10. [Transaction Ledger](#10-transaction-ledger)
11. [Key File Locations](#11-key-file-locations)

---

## 1. Core Entities

### Checkout
**File:** `server/polar/models/checkout.py`

Shopping cart/payment session before order confirmation.

| Field | Type | Description |
|-------|------|-------------|
| `status` | CheckoutStatus | open, expired, confirmed, succeeded, failed |
| `payment_processor` | PaymentProcessor | stripe, manual |
| `client_secret` | str | Unique identifier for frontend |
| `amount`, `currency` | int, str | Price in cents |
| `tax_amount`, `discount_amount` | int | Calculated amounts |
| `allow_trial`, `trial_end` | bool, datetime | Trial configuration |
| `seats` | int | For seat-based products |

**Relationships:** organization, customer, product, product_price, discount, subscription (for upgrades)

---

### Order
**File:** `server/polar/models/order.py`

Represents a billing event (one-time purchase or subscription cycle).

| Field | Type | Description |
|-------|------|-------------|
| `status` | OrderStatus | pending, paid, refunded, partially_refunded |
| `billing_reason` | OrderBillingReason | purchase, subscription_create, subscription_cycle, subscription_update |
| `subtotal_amount` | int | Amount before discount/tax |
| `discount_amount` | int | Discount applied |
| `tax_amount` | int | Tax collected |
| `applied_balance_amount` | int | Account balance applied |
| `platform_fee_amount` | int | Polar's fee |
| `refunded_amount` | int | Already refunded |
| `next_payment_attempt_at` | datetime | Dunning retry time |

**Computed Properties:**
- `net_amount` = subtotal - discount
- `total_amount` = net + tax
- `due_amount` = max(0, total + applied_balance)
- `payout_amount` = net - platform_fee - refunded

---

### Subscription
**File:** `server/polar/models/subscription.py`

Recurring billing relationship.

| Field | Type | Description |
|-------|------|-------------|
| `status` | SubscriptionStatus | incomplete, trialing, active, past_due, canceled, unpaid |
| `amount`, `currency` | int, str | Subscription price |
| `recurring_interval` | Interval | month, year |
| `current_period_start/end` | datetime | Billing period |
| `trial_start/end` | datetime | Trial period |
| `cancel_at_period_end` | bool | Scheduled cancellation |
| `canceled_at`, `ended_at` | datetime | Lifecycle timestamps |
| `past_due_at` | datetime | When payment failed |
| `seats` | int | For seat-based pricing |

**Relationships:** customer, product, payment_method, discount, meters, grants (benefits)

---

### Transaction
**File:** `server/polar/models/transaction.py`

All money flows in the system.

| Field | Type | Description |
|-------|------|-------------|
| `type` | TransactionType | payment, processor_fee, refund, dispute, balance, payout |
| `processor` | Processor | stripe, manual |
| `amount`, `currency` | int, str | Transaction amount |
| `tax_amount` | int | Tax portion |

**Self-referential relationships:** payment_transaction, balance_transactions, incurred_transactions

---

### Payment
**File:** `server/polar/models/payment.py`

Individual payment transaction.

| Field | Type | Description |
|-------|------|-------------|
| `status` | PaymentStatus | pending, succeeded, failed |
| `processor_id` | str | Stripe charge ID |
| `method` | str | card, bank_transfer, etc. |
| `decline_reason` | str | Why payment failed |
| `risk_level`, `risk_score` | str, int | Fraud assessment |

---

### Refund
**File:** `server/polar/models/refund.py`

| Field | Type | Description |
|-------|------|-------------|
| `status` | RefundStatus | pending, succeeded, failed, canceled |
| `reason` | RefundReason | duplicate, fraudulent, customer_request, etc. |
| `amount`, `tax_amount` | int | Refund amounts |
| `revoke_benefits` | bool | Whether to revoke customer benefits |

---

### Customer
**File:** `server/polar/models/customer.py`

| Field | Type | Description |
|-------|------|-------------|
| `email`, `name` | str | Contact info |
| `stripe_customer_id` | str | Stripe link |
| `billing_address` | Address | Stored address |
| `tax_id` | str | For tax compliance |

---

### Product & ProductPrice
**Files:** `server/polar/models/product.py`, `server/polar/models/product_price.py`

| ProductPrice Types | Description |
|-------------------|-------------|
| `ProductPriceFixed` | Fixed amount |
| `ProductPriceCustom` | Merchant sets at checkout |
| `ProductPriceFree` | Zero cost |
| `ProductPriceMeteredUnit` | Pay-per-unit |
| `ProductPriceSeatUnit` | Per-seat with tiers |

---

### BillingEntry
**File:** `server/polar/models/billing_entry.py`

Audit log for billing calculations.

| Field | Type | Description |
|-------|------|-------------|
| `type` | BillingEntryType | cycle, proration, metered, seats_increase, seats_decrease |
| `direction` | Direction | debit, credit |
| `amount` | int | Entry amount |

---

## 2. Entity Relationships

```
Organization
├── Product
│   ├── ProductPrice (multiple per product)
│   └── ProductBenefit → Benefit
├── Customer
│   ├── Subscription → Product, Discount
│   │   ├── SubscriptionProductPrice
│   │   ├── SubscriptionMeter
│   │   └── BenefitGrant
│   ├── Order → Product, Subscription
│   │   └── OrderItem
│   ├── PaymentMethod
│   └── Wallet
├── Checkout → Customer, Product
├── Discount
│   └── DiscountRedemption
└── Account (for payouts)
    └── Payout → Transaction

Transaction (ledger)
├── payment → Order, Customer
├── refund → Refund, Order
├── dispute → Dispute, Order
├── processor_fee → parent payment
└── payout → Account
```

---

## 3. Main Services

### SubscriptionService
**File:** `server/polar/subscription/service.py`

Core subscription operations:

```python
# Creation
create_or_update_from_checkout(checkout, payment_method) → (Subscription, created)

# Updates
update_product(subscription, product_id, proration_behavior)
update_seats(subscription, seats, proration_behavior)
update_discount(subscription, discount_id)
update_trial(subscription, trial_end)

# Lifecycle
cycle(subscription)  # Period renewal
cancel(subscription)  # At period end
revoke(subscription)  # Immediately
uncancel(subscription)

# Benefits
enqueue_benefits_grants(task="grant"|"revoke", customer, product)
```

### OrderService
**File:** `server/polar/order/service.py`

```python
create_from_checkout(checkout)  # One-time purchase
create_subscription_order(subscription, billing_reason)  # Recurring
trigger_payment(order)  # Charge customer
create_order_balance(order)  # Ledger entries
```

### CheckoutService
**File:** `server/polar/checkout/service.py`

```python
create(product, customer_data, discount_code)
confirm(checkout)  # Lock checkout for payment
handle_stripe_success(checkout, charge)
handle_free_success(checkout)  # No payment needed
```

### PaymentService
**File:** `server/polar/payment/service.py`

```python
upsert_from_stripe_charge(charge, checkout, order)
handle_success(payment)  # Complete order
handle_failure(payment)  # Update order status
```

### RefundService
**File:** `server/polar/refund/service.py`

```python
create(order, amount, reason, revoke_benefits)
upsert_from_stripe(stripe_refund)
```

### BenefitGrantService
**File:** `server/polar/benefit/grant/service.py`

```python
enqueue_benefits_grants(task, customer, product, order=None, subscription=None)
grant_benefit(customer, benefit)
revoke_benefit(customer, benefit)
```

---

## 4. Dramatiq Background Tasks

### Subscription Tasks
**File:** `server/polar/subscription/tasks.py`

| Task | Trigger | Action |
|------|---------|--------|
| `subscription.cycle` | Scheduler at period end | Renew subscription, create order |
| `subscription.update_product_benefits_grants` | Product benefits changed | Update all grants |
| `subscription.cancel_customer` | Customer deleted | Cancel all subscriptions |

### Order Tasks
**File:** `server/polar/order/tasks.py`

| Task | Trigger | Action |
|------|---------|--------|
| `order.create_subscription_order` | Subscription cycle | Create billing order |
| `order.trigger_payment` | Order ready | Charge payment method |
| `order.balance` | Payment success | Create ledger entries |
| `order.invoice` | Order created | Generate PDF invoice |
| `order.process_dunning` | **Hourly cron** | Find orders for retry |
| `order.process_dunning_order` | Individual retry | Retry single payment |

### Stripe Webhook Tasks
**File:** `server/polar/integrations/stripe/tasks.py`

| Task | Stripe Event | Action |
|------|--------------|--------|
| `charge.succeeded` | Payment complete | Create order, provision benefits |
| `charge.failed` | Payment failed | Mark order failed |
| `charge.updated` | Charge settled | Create ledger transaction |
| `refund.created/updated` | Refund processed | Update refund record |
| `charge.dispute.created` | Chargeback | Create dispute, revoke benefits |
| `payout.paid` | Payout complete | Update payout status |

### Benefit Tasks
**File:** `server/polar/benefit/tasks.py`

| Task | Trigger | Action |
|------|---------|--------|
| `benefit.enqueue_benefits_grants` | Order/subscription | Queue individual grants |
| `benefit.grant` | Individual benefit | Provision access (GitHub, Discord, etc.) |
| `benefit.revoke` | Cancellation/refund | Remove access |
| `benefit.cycle` | Subscription renewal | Reset credits with rollover |

### Checkout Tasks
**File:** `server/polar/checkout/tasks.py`

| Task | Trigger | Action |
|------|---------|--------|
| `checkout.handle_free_success` | Free product | Complete without payment |
| `checkout.expire_open_checkouts` | **Every 15 min** | Mark expired checkouts |

### Payout Tasks
**File:** `server/polar/payout/tasks.py`

| Task | Trigger | Action |
|------|---------|--------|
| `payout.trigger_stripe_payouts` | **Daily 00:15 UTC** | Initiate pending payouts |

---

## 5. Stripe Integration

### Webhook Endpoints
**File:** `server/polar/integrations/stripe/endpoints.py`

- `/v1/integrations/stripe/webhook` - Direct webhooks
- `/v1/integrations/stripe/webhook-connect` - Connect account webhooks

### Implemented Webhooks

**Payment Flow:**
- `payment_intent.succeeded` - Payment complete
- `payment_intent.payment_failed` - Payment failed
- `setup_intent.succeeded` - Card saved
- `charge.pending/failed/succeeded/updated` - Charge lifecycle

**Refunds:**
- `refund.created/updated/failed`

**Disputes:**
- `charge.dispute.created/updated/closed`

**Connect:**
- `account.updated` - Account info changed
- `payout.updated/paid` - Payout lifecycle

### Webhook Processing Flow

```
Stripe POST → Verify signature → ExternalEvent.enqueue()
                                        ↓
                               Store in external_events table
                                        ↓
                               Enqueue Dramatiq task
                                        ↓
                               Worker processes async
                                        ↓
                               Mark handled_at on success
```

### StripeService
**File:** `server/polar/integrations/stripe/service.py`

Key methods:
- `create_payment_intent()`, `create_setup_intent()`
- `create_refund()`, `get_refund()`
- `create_tax_calculation()`, `create_tax_transaction()`
- `transfer()`, `create_payout()`

---

## 6. Subscription Lifecycle

### Creation Flow

```
1. Checkout created (status=open)
2. Customer completes payment
3. Stripe charge.succeeded webhook
4. payment.handle_success() called
5. checkout_service.handle_stripe_success()
6. subscription_service.create_or_update_from_checkout()
   - Creates Subscription (status=active or trialing)
   - Sets billing period
   - Applies discount
   - Resets meters
7. Enqueue benefit grants
8. Send confirmation email
```

### Cycle Flow (Renewal)

```
1. APScheduler triggers at period end
2. subscription.cycle task runs
3. subscription_service.cycle()
   - Check cancel_at_period_end
   - If true: set status=canceled, revoke benefits
   - If false: advance period dates, check discount expiry
4. Create billing entry (type=cycle)
5. Enqueue order.create_subscription_order
6. Order created with billing_reason=subscription_cycle
7. Enqueue order.trigger_payment
8. Stripe charges payment method
9. charge.succeeded → ledger entries → benefits renewed
```

### Cancellation Flow

**At Period End:**
```python
subscription_service.cancel(subscription)
# Sets cancel_at_period_end=True, ends_at=current_period_end
# Benefits remain until period ends
# On next cycle: status=canceled, benefits revoked
```

**Immediately:**
```python
subscription_service.revoke(subscription)
# Sets status=canceled, ended_at=now
# Benefits revoked immediately
# Seats canceled if seat-based
```

### Trial Flow

```
1. Checkout with trial_end set
2. Subscription created with status=trialing
3. No payment during trial
4. At trial_end, cycle task runs
5. Status transitions to active
6. Order created with billing_reason=subscription_cycle_after_trial
7. First payment charged
```

---

## 7. Proration System

### When Prorations Occur

1. **Product change** - Upgrade/downgrade to different tier
2. **Seat change** - Add/remove seats
3. **Interval change** - Monthly to yearly

### Proration Calculation

```python
# Calculate time remaining in period
pct_remaining = (period_end - now) / (period_end - period_start)

# Old product credit (what they paid but won't use)
old_credit = old_price * old_pct_remaining

# New product debit (what they owe for remainder)
new_debit = new_price * new_pct_remaining

# Net proration
net = new_debit - old_credit
```

### Proration Behaviors

| Behavior | Action |
|----------|--------|
| `prorate` | Add to next invoice |
| `invoice` | Create order immediately |

### BillingEntry for Prorations

```python
# Credit entry (old product)
BillingEntry(
    type=BillingEntryType.proration,
    direction=BillingEntryDirection.credit,
    amount=prorated_old_amount
)

# Debit entry (new product)
BillingEntry(
    type=BillingEntryType.proration,
    direction=BillingEntryDirection.debit,
    amount=prorated_new_amount
)
```

### Seat Proration

```python
# Adding 2 seats at $10/seat with 50% time remaining
delta_amount = 2 * $10 * 0.5 = $10

BillingEntry(
    type=BillingEntryType.subscription_seats_increase,
    direction=BillingEntryDirection.debit,
    amount=1000  # cents
)
```

---

## 8. Benefits & Credits

### Benefit Types

| Type | Description | Grant Action |
|------|-------------|--------------|
| `meter_credit` | Usage allowances | Create meter_credited event |
| `github_repository` | Repo access | Add to GitHub team |
| `discord` | Server role | Assign Discord role |
| `license_keys` | License distribution | Generate key |
| `downloadables` | File access | Grant download permission |
| `custom` | Webhook-based | Call external URL |

### Benefit Grant Flow

```
1. Order/Subscription created
2. enqueue_benefits_grants(task="grant")
3. For each benefit in product:
   - Skip if already granted
   - Enqueue benefit.grant task
4. benefit.grant task:
   - Get/create BenefitGrant record
   - Call strategy.grant() (type-specific)
   - Set granted_at
   - Store properties
   - Send webhook
```

### Benefit Revocation Flow

```
1. Subscription canceled or order refunded
2. enqueue_benefits_grants(task="revoke")
3. For each granted benefit:
   - Enqueue benefit.revoke task
4. benefit.revoke task:
   - Call strategy.revoke() (type-specific)
   - Set revoked_at
   - Send webhook
```

### Meter Credits

**Grant:**
```python
# Create event with units
Event(type="meter_credited", units=100)
# Update CustomerMeter
```

**Cycle (renewal):**
```python
# Calculate rollover
rollover = min(remaining_units, rollover_limit)
# Reset meter
Event(type="meter_reset")
# Credit new period + rollover
Event(type="meter_credited", units=base_units + rollover)
```

**Revoke:**
```python
# Negative credit event
Event(type="meter_credited", units=-remaining_units)
```

### Grace Period

Organizations can configure `benefit_revocation_grace_period` (days) to delay benefit revocation for `past_due` subscriptions.

---

## 9. Dunning & Payment Retry

### Dunning Process

```
1. order.process_dunning runs hourly
2. Finds orders where next_payment_attempt_at <= now
3. For each order:
   - Enqueue order.process_dunning_order
4. process_dunning_order:
   - Get customer's payment method
   - Attempt payment via Stripe
   - On success: mark order paid
   - On failure: schedule next attempt
```

### Retry Schedule

Configured in organization settings. Typical pattern:
- Day 1: First failure
- Day 3: Retry 1
- Day 5: Retry 2
- Day 7: Final retry, then mark unpaid

### Subscription Status During Dunning

```
payment fails → status=past_due, past_due_at=now
               ↓
         benefits may continue (grace period)
               ↓
         retry succeeds → status=active
               ↓
         retry fails → status=unpaid, benefits revoked
```

---

## 10. Transaction Ledger

### Transaction Types

| Type | Description |
|------|-------------|
| `payment` | Customer payment received |
| `processor_fee` | Stripe fees |
| `refund` | Money returned to customer |
| `refund_reversal` | Refund failed/reversed |
| `dispute` | Chargeback loss |
| `dispute_reversal` | Won dispute |
| `balance` | Internal balance transfer |
| `payout` | Money sent to creator |

### Creating Payment Transactions

```
1. charge.updated webhook (charge settled)
2. Get balance_transaction from Stripe
3. Extract settlement amount and fees
4. Create Transaction(type=payment)
5. Enqueue processor_fee.create_payment_fees
6. Create Transaction(type=processor_fee)
```

### Payout Flow

```
1. Creator has balance from transactions
2. payout.trigger_stripe_payouts (daily)
3. Calculate available balance
4. Create Payout record
5. stripe_service.transfer() to Connect account
6. stripe_service.create_payout() to bank
7. payout.paid webhook → update status
```

---

## 11. Key File Locations

### Models
```
server/polar/models/
├── checkout.py
├── order.py
├── order_item.py
├── subscription.py
├── subscription_product_price.py
├── transaction.py
├── payment.py
├── refund.py
├── dispute.py
├── payout.py
├── customer.py
├── product.py
├── product_price.py
├── discount.py
├── benefit.py
├── benefit_grant.py
└── billing_entry.py
```

### Services
```
server/polar/
├── subscription/service.py
├── order/service.py
├── checkout/service.py
├── payment/service.py
├── refund/service.py
├── dispute/service.py
├── payout/service.py
├── benefit/
│   ├── service.py
│   ├── grant/service.py
│   └── strategies/
│       ├── meter_credit/service.py
│       ├── github_repository/service.py
│       ├── discord/service.py
│       └── ...
└── transaction/service/
    ├── payment.py
    ├── refund.py
    └── dispute.py
```

### Background Tasks
```
server/polar/
├── subscription/tasks.py
├── order/tasks.py
├── checkout/tasks.py
├── benefit/tasks.py
├── payout/tasks.py
└── integrations/stripe/tasks.py
```

### Stripe Integration
```
server/polar/integrations/stripe/
├── endpoints.py    # Webhook handlers
├── service.py      # Stripe API wrapper
├── tasks.py        # Webhook processing tasks
└── payment.py      # Payment resolution helpers
```

---

## Common Debugging Scenarios

### Payment Failed
1. Check `Payment` record for `decline_reason`
2. Check `Order.status` and `next_payment_attempt_at`
3. Look at external_events for Stripe webhook

### Benefits Not Granted
1. Check `BenefitGrant` record for errors
2. Look at benefit.grant task in Dramatiq logs
3. Verify product has benefits attached

### Proration Issues
1. Check `BillingEntry` records for subscription
2. Verify billing_reason on Order
3. Check subscription's current_period dates

### Subscription Not Cycling
1. Check `scheduler_locked_at` on subscription
2. Verify APScheduler is running
3. Check subscription.cycle task logs

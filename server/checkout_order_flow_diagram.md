# Checkout to Order Flow and Stripe Webhook Events

## Complete Flow Diagram

```mermaid
sequenceDiagram
    participant Frontend
    participant API as Polar API
    participant DB as Database
    participant Stripe
    participant Webhooks as Stripe Webhooks
    participant Tasks as Background Tasks

    %% Checkout Confirmation Phase
    Frontend->>API: POST /checkout/{id}/confirm
    API->>DB: Update checkout status
    API->>API: Validate checkout & customer
    
    %% Determine Intent Type Based on Payment Requirement
    alt Payment Required (amount > 0)
        Note over API: One-time OR first payment of recurring
        API->>Stripe: Create PaymentIntent with confirm=True
        Note over Stripe: metadata: checkout_id, tax_amount, tax_country
        alt Recurring Product
            Note over API: Add setup_future_usage="off_session"
        end
    else Free Product (amount = 0)
        API->>Stripe: Create SetupIntent with confirm=True
        Note over Stripe: Save payment method for future use
    end
    
    %% Immediate Stripe Processing
    Stripe-->>Stripe: Process payment/setup immediately
    Stripe->>API: Return Intent status (succeeded/requires_action/failed)
    
    %% Response to Frontend
    API->>Frontend: Return confirmation response
    Note over Frontend: May require additional 3DS action
    
    %% Parallel Webhook Events from Stripe
    par Stripe Webhook Events
        alt PaymentIntent Flow (Payment Required)
            Stripe->>Webhooks: payment_intent.succeeded
            Webhooks->>Tasks: payment_intent_succeeded(event_id)
            Tasks->>API: stripe_payment.handle_success(payment_intent)
            Note over Tasks: ⚠️ Type Issue: PaymentIntent not supported
        end
    and
        alt Charge Created (Money Movement)
            Stripe->>Webhooks: charge.succeeded  
            Webhooks->>Tasks: charge_succeeded(event_id)
            Tasks->>API: stripe_payment.handle_success(charge)
            API->>API: payment_service.upsert_from_stripe_charge()
            API->>DB: Create/update Payment record
        end
    and  
        alt SetupIntent Flow (Free Products)
            Stripe->>Webhooks: setup_intent.succeeded
            Webhooks->>Tasks: setup_intent_succeeded(event_id)
            Tasks->>API: stripe_payment.handle_success(setup_intent)
            API->>API: payment_method_service.upsert_from_stripe_intent()
            API->>DB: Create/update PaymentMethod record
        end
    end
    
    %% Order Creation - Different Timing Based on Product Type
    alt One-time Purchase
        Note over API: Order created during handle_success
        API->>API: checkout_service.handle_success()
        API->>API: order_service.create_from_checkout_one_time()
        API->>DB: Create Order (status: paid)
        API->>API: order_service.handle_payment()
        API->>DB: Update Order status & clear payment locks
    else Recurring - Polar Managed
        Note over API: Order created during handle_success
        API->>API: checkout_service.handle_success()
        API->>API: subscription_service.create_or_update_from_checkout()
        API->>DB: Create/update Subscription
        API->>API: order_service.create_from_checkout_subscription()
        API->>DB: Create Order (billing_reason: subscription_create)
        API->>API: order_service.handle_payment()
        API->>DB: Update Order status
    else Recurring - Stripe Managed (Legacy)
        Note over API: Orders created from invoice webhooks
        Stripe->>Webhooks: invoice.created
        Webhooks->>API: order_service.create_order_from_stripe()
        API->>DB: Create Order from Stripe Invoice
        Stripe->>Webhooks: invoice.paid
        Webhooks->>API: order_service.update_order_from_stripe()
        API->>DB: Update Order status to paid
    end
    
    %% Post-Payment Processing
    API->>Tasks: Enqueue benefit grants
    API->>Tasks: Enqueue webhook notifications
    API->>Tasks: Enqueue confirmation emails
```

## Manual Payment Retry Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant API as Polar API
    participant DB as Database  
    participant Stripe
    participant Webhooks as Stripe Webhooks
    participant Tasks as Background Tasks

    %% Manual Retry Initiation
    Frontend->>API: POST /orders/{id}/retry-payment/confirm
    API->>DB: Check order status (must be pending)
    API->>API: Validate retry eligibility
    
    %% Create PaymentIntent for Retry
    API->>Stripe: Create PaymentIntent with confirm=True
    Note over Stripe: metadata: order_id, organization_id, customer_id
    Stripe-->>Stripe: Process payment immediately
    Stripe->>API: Return PaymentIntent status
    
    %% Response (No Direct Status Update)
    API->>Frontend: Return payment confirmation status
    Note over API: Does NOT update order status<br/>Relies on webhooks
    
    %% Duplicate Webhook Problem
    par Multiple Webhooks Fire
        Stripe->>Webhooks: payment_intent.succeeded
        Webhooks->>Tasks: payment_intent_succeeded(event_id)
        Tasks->>API: stripe_payment.handle_success()
        API->>API: Resolve order via order_id metadata
        API->>API: order_service.handle_payment()
        alt First webhook
            API->>DB: Update order: pending → paid
            Note over API: ✅ Success
        else Second webhook  
            Note over API: ⚠️ Order already paid
            API->>API: OrderNotPending exception
            Note over Tasks: ❌ Webhook fails
        end
    and
        Stripe->>Webhooks: charge.succeeded
        Webhooks->>Tasks: charge_succeeded(event_id) 
        Tasks->>API: stripe_payment.handle_success()
        API->>API: payment_service.upsert_from_stripe_charge()
        API->>API: order_service.handle_payment()
        Note over API: May succeed or fail depending on timing
    end
```

## Key Differences: Checkout vs Manual Retry

| Aspect | Checkout Flow | Manual Retry Flow |
|--------|---------------|-------------------|
| **Order Creation** | Created during webhook processing | Order already exists |
| **Metadata** | `checkout_id` in Stripe intent | `order_id` in Stripe intent |
| **Webhook Resolution** | Resolves via checkout → order relationship | Resolves directly via order_id |
| **Status Updates** | Order created with final status | Order updated from pending → paid |
| **Duplicate Handling** | Checkout provides natural deduplication | No built-in deduplication |
| **Error Tolerance** | More resilient to race conditions | Prone to OrderNotPending errors |

## Webhook Event Types and Handlers

```mermaid
graph TD
    A[Stripe Events] --> B[payment_intent.succeeded]
    A --> C[charge.succeeded]  
    A --> D[setup_intent.succeeded]
    A --> E[invoice.created]
    A --> F[invoice.paid]
    
    B --> G[payment_intent_succeeded Task]
    C --> H[charge_succeeded Task]
    D --> I[setup_intent_succeeded Task]
    E --> J[invoice_created Task] 
    F --> K[invoice_paid Task]
    
    G --> L[stripe_payment.handle_success]
    H --> L
    I --> L
    
    J --> M[order_service.create_order_from_stripe]
    K --> N[order_service.update_order_from_stripe]
    
    L --> O[Resolve checkout/order]
    L --> P[Create/update Payment]
    L --> Q[Create/update PaymentMethod]
    L --> R[order_service.handle_payment]
    
    R --> S[Update order status: pending → paid]
    R --> T[Clear payment locks]
    R --> U[Enqueue post-payment tasks]
    
    style G fill:#ffcccc
    style B fill:#ffcccc
    Note1[⚠️ Type mismatch:<br/>PaymentIntent not supported<br/>by handle_success]
```

## Race Condition and Duplicate Webhook Issues

### Problem: Multiple Webhooks for Same Payment

1. **PaymentIntent with confirm=True** triggers multiple webhooks:
   - `payment_intent.succeeded` 
   - `charge.succeeded`

2. **Both webhooks try to process the same order:**
   - First webhook: `order.status = pending` → `paid` ✅
   - Second webhook: `order.status = paid` → `OrderNotPending` ❌

### Current Handling

- **Checkout flow**: Has natural deduplication via checkout status
- **Manual retry flow**: No protection against duplicate processing
- **webhook retry**: Built-in retry mechanism for dependency issues
- **External event service**: Handles webhook deduplication at event level

### Proposed Solutions

1. **Make `order_service.handle_payment()` idempotent**
2. **Add OrderNotPending to webhook exception handling**
3. **Use payment locks more effectively**
4. **Improve webhook event type specific processing**

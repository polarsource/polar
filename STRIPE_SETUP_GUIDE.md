# Stripe Setup Guide for AgentPay

**Date**: 2025-11-17
**Purpose**: Complete guide to configure Stripe for AgentPay payments
**Prerequisites**: Polar codebase (payment infrastructure already built)

---

## Executive Summary

**What Polar Uses**: Stripe is the complete payment backend
**What You Need**:
1. Stripe account (test or live)
2. 4 API keys/secrets
3. 2 webhook endpoints
4. Product/Price setup in Stripe dashboard

**Time to Setup**: 30-45 minutes

---

## Part 1: Create Stripe Account

### Step 1: Sign Up

1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Enter business information:
   - Business name: "AgentPay" or your company name
   - Country: Select your country
   - Business type: E-commerce, SaaS, or Marketplace

4. Verify email and phone number

### Step 2: Activate Account

Complete Stripe onboarding:
- Business details (legal name, address, tax ID)
- Bank account for payouts
- Identity verification (for live mode)

**Note**: You can use Test Mode without completing activation!

---

## Part 2: Get API Keys

### Test Mode Keys (For Development)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the following keys:

**Publishable Key** (starts with `pk_test_`):
```
pk_test_51ABC...
```

**Secret Key** (starts with `sk_test_`):
```
sk_test_51ABC...
```

**⚠️ IMPORTANT**: Never commit secret keys to git!

### Live Mode Keys (For Production)

1. Complete account activation
2. Go to: https://dashboard.stripe.com/apikeys
3. Copy live keys (`pk_live_...` and `sk_live_...`)

---

## Part 3: Configure Webhooks

Polar uses 2 webhook endpoints for different events.

### Webhook 1: Direct Payment Events

**Purpose**: Handle payment confirmations, subscription updates, refunds

**Events to Subscribe**:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `setup_intent.succeeded`
- `setup_intent.setup_failed`
- `charge.pending`
- `charge.failed`
- `charge.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created`
- `invoice.paid`
- `invoice.payment_failed`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.closed`
- `identity.verification_session.verified`
- `identity.verification_session.requires_input`

**Setup Steps**:

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "+ Add endpoint"
3. Enter endpoint URL:
   ```
   https://your-domain.com/v1/integrations/stripe/webhook
   ```

4. Select events (listed above)

5. Click "Add endpoint"

6. Copy **Signing Secret** (starts with `whsec_`):
   ```
   whsec_abc123...
   ```

7. Save as `POLAR_STRIPE_WEBHOOK_SECRET`

### Webhook 2: Stripe Connect Events

**Purpose**: Handle payout events for merchants (if using Connect)

**Events to Subscribe**:
- `account.updated`
- `payout.created`
- `payout.updated`
- `payout.paid`
- `payout.failed`

**Setup Steps**:

1. Click "+ Add endpoint" again
2. Enter endpoint URL:
   ```
   https://your-domain.com/v1/integrations/stripe/webhook-connect
   ```

3. Select "Connect" tab
4. Select events (listed above)
5. Click "Add endpoint"
6. Copy **Signing Secret**:
   ```
   whsec_xyz789...
   ```

7. Save as `POLAR_STRIPE_CONNECT_WEBHOOK_SECRET`

---

## Part 4: Environment Variables

Add these to `server/.env`:

```bash
# Stripe API Keys
POLAR_STRIPE_SECRET_KEY=sk_test_51ABC...
POLAR_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...

# Webhook Secrets
POLAR_STRIPE_WEBHOOK_SECRET=whsec_abc123...
POLAR_STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xyz789...

# Optional: Stripe Connect (for multi-merchant)
# POLAR_STRIPE_CONNECT_ENABLED=true
```

**For Production** (replace `test` with `live`):
```bash
POLAR_STRIPE_SECRET_KEY=sk_live_51ABC...
POLAR_STRIPE_PUBLISHABLE_KEY=pk_live_51ABC...
POLAR_STRIPE_WEBHOOK_SECRET=whsec_live_abc...
POLAR_STRIPE_CONNECT_WEBHOOK_SECRET=whsec_live_xyz...
```

---

## Part 5: Test Stripe Integration

### Verify Configuration

```bash
cd server

# Test Stripe connection
uv run python -c "
import stripe
from polar.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY
account = stripe.Account.retrieve()
print(f'✅ Stripe connected: {account.id}')
"
```

Expected output:
```
✅ Stripe connected: acct_1ABC123
```

### Test Webhook Locally (Development)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.0/stripe_1.19.0_linux_x86_64.tar.gz
tar -xvf stripe_1.19.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

Login and forward webhooks:
```bash
# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/v1/integrations/stripe/webhook

# In another terminal, start API
cd server
uv run task api
```

Test a payment:
```bash
stripe trigger payment_intent.succeeded
```

Check logs for webhook processing.

---

## Part 6: Create Test Products

### Option 1: Via Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/products
2. Click "+ Add product"
3. Enter details:
   - **Name**: "Premium Running Shoes"
   - **Description**: "High-quality running shoes"
   - **Pricing**:
     - One-time: $150.00 USD
     - Or recurring: $19.99/month
   - **Tax code**: Physical goods
4. Click "Add product"
5. Copy **Product ID**: `prod_ABC123`
6. Copy **Price ID**: `price_XYZ789`

### Option 2: Via API

```python
# Create product via API
from polar.integrations.stripe import stripe_service
from polar.postgres import async_session_maker

async def create_test_product():
    async with async_session_maker() as session:
        # This will create Stripe product automatically
        product = await product_service.create(
            session,
            organization_id=org_id,
            product_create={
                "name": "Premium Running Shoes",
                "description": "High-quality running shoes",
                "is_recurring": False,
                "prices": [
                    {
                        "price_amount": 15000,  # $150 in cents
                        "price_currency": "usd",
                    }
                ],
            }
        )
        print(f"✅ Product created: {product.id}")
        print(f"   Stripe Product ID: {product.stripe_product_id}")
```

---

## Part 7: Test Checkout Flow

### Complete Payment Flow Test

```bash
# 1. Start API server
cd server
uv run task api

# 2. Create test conversation
curl -X POST http://localhost:8000/v1/agent/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test_session_123",
    "organization_id": "your-org-id"
  }'

# Save conversation ID from response

# 3. Simulate chat leading to purchase
curl -X POST http://localhost:8000/v1/agent/conversations/{conv_id}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I want to buy the running shoes",
    "context": {}
  }'

# Agent should respond with checkout link or initiate payment flow
```

### Test Payment in Stripe

Use test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)

### Verify Webhook Processing

```bash
# Check logs for webhook events
tail -f server/logs/polar.log | grep stripe

# Expected output:
# ✅ Webhook received: payment_intent.succeeded
# ✅ Order marked as paid: order_abc123
# ✅ Conversation updated: stage=completed
```

---

## Part 8: Stripe Connect Setup (Multi-Merchant)

If you want merchants to receive payouts (marketplace model):

### Enable Stripe Connect

1. Go to: https://dashboard.stripe.com/settings/applications
2. Enable "OAuth"
3. Add redirect URI:
   ```
   https://your-domain.com/v1/integrations/stripe/oauth/callback
   ```

4. Copy **Client ID**: `ca_ABC123`

5. Add to `.env`:
   ```bash
   POLAR_STRIPE_CONNECT_ENABLED=true
   POLAR_STRIPE_CLIENT_ID=ca_ABC123
   ```

### Merchant Onboarding Flow

```python
# 1. Merchant clicks "Connect Stripe"
# 2. Redirect to Stripe OAuth:
oauth_url = f"https://connect.stripe.com/oauth/authorize?client_id={client_id}&scope=read_write&response_type=code"

# 3. Stripe redirects back with code
# 4. Exchange code for account ID:
response = stripe.OAuth.token(grant_type='authorization_code', code=code)
stripe_account_id = response['stripe_user_id']

# 5. Save to database:
account.stripe_id = stripe_account_id
await session.commit()
```

Merchant can now receive payouts!

---

## Part 9: Production Checklist

Before going live:

### Security

- [ ] ✅ Secret keys in environment variables (not code)
- [ ] ✅ HTTPS enabled on domain
- [ ] ✅ Webhook signature verification enabled
- [ ] ✅ Rate limiting configured
- [ ] ✅ Error logging to Sentry/similar

### Stripe Dashboard

- [ ] ✅ Account fully activated
- [ ] ✅ Bank account added for payouts
- [ ] ✅ Tax settings configured
- [ ] ✅ Email receipts enabled
- [ ] ✅ Fraud detection rules reviewed

### Testing

- [ ] ✅ Test successful payment
- [ ] ✅ Test failed payment
- [ ] ✅ Test refund
- [ ] ✅ Test subscription (if applicable)
- [ ] ✅ Test webhook processing
- [ ] ✅ Test payout (if Connect enabled)

### Compliance

- [ ] ✅ Privacy policy updated (Stripe mentioned)
- [ ] ✅ Terms of service updated (payment terms)
- [ ] ✅ PCI compliance reviewed (Stripe handles most)
- [ ] ✅ GDPR/data retention policy

---

## Part 10: Monitoring & Maintenance

### Key Metrics to Monitor

1. **Payment Success Rate**: Should be >95%
2. **Webhook Processing Time**: Should be <2s
3. **Failed Webhooks**: Should be <1%
4. **Refund Rate**: Monitor for fraud
5. **Payout Status**: If using Connect

### Stripe Dashboard (Monitor Daily)

- https://dashboard.stripe.com/payments (payment activity)
- https://dashboard.stripe.com/webhooks (webhook logs)
- https://dashboard.stripe.com/radar (fraud detection)

### Alerts to Set Up

```bash
# In your monitoring tool (Datadog, New Relic, etc.)

# Alert if payment success rate drops below 90%
if payment_success_rate < 0.90:
    alert("Stripe payment issues")

# Alert if webhook processing fails
if webhook_failures > 10 per hour:
    alert("Stripe webhook processing errors")

# Alert if refund rate spikes
if refund_rate > 0.05:  # >5%
    alert("High refund rate - investigate")
```

---

## Part 11: Common Issues & Solutions

### Issue 1: Webhook Not Receiving Events

**Symptoms**: Payments succeed in Stripe but orders not marked as paid

**Solutions**:
1. Check webhook URL is correct and accessible
2. Verify signing secret matches `.env`
3. Check firewall allows Stripe IPs
4. Test with Stripe CLI: `stripe listen --forward-to ...`
5. Check logs for webhook errors

### Issue 2: Signature Verification Failed

**Symptoms**: Webhook returns 400 error

**Solutions**:
1. Verify `POLAR_STRIPE_WEBHOOK_SECRET` is correct
2. Check webhook payload not modified
3. Ensure using raw body (not parsed JSON)
4. Test signature verification:
   ```python
   import stripe
   stripe.Webhook.construct_event(
       payload, sig_header, webhook_secret
   )
   ```

### Issue 3: Duplicate Charges

**Symptoms**: Customer charged twice

**Solutions**:
1. Use idempotency keys (Polar does this automatically)
2. Check for duplicate webhook processing
3. Review checkout session creation logic
4. Refund duplicate charges immediately

### Issue 4: Payouts Not Working (Connect)

**Symptoms**: Merchants not receiving payouts

**Solutions**:
1. Verify merchant account is activated
2. Check payout schedule settings
3. Verify bank account is connected
4. Check balance (must be >$1 for payout)
5. Review payout logs in Stripe Dashboard

---

## Part 12: Stripe Best Practices

### 1. Always Use Idempotency Keys

```python
# Polar does this automatically, but ensure it's enabled
stripe.PaymentIntent.create(
    amount=1000,
    currency='usd',
    idempotency_key=f'checkout_{checkout_id}'
)
```

### 2. Handle Webhooks Idempotently

```python
# Polar's implementation
async def handle_payment_succeeded(event):
    payment_intent_id = event.data.object.id

    # Check if already processed
    existing = await get_order_by_stripe_id(payment_intent_id)
    if existing and existing.status == 'paid':
        logger.info(f"Already processed: {payment_intent_id}")
        return

    # Process payment...
```

### 3. Use Metadata for Linking

```python
# Polar's approach
stripe.PaymentIntent.create(
    amount=1000,
    currency='usd',
    metadata={
        'checkout_id': checkout.id,
        'order_id': order.id,
        'organization_id': org.id,
    }
)
```

### 4. Enable Automatic Tax Calculation

```python
# Already enabled in Polar
stripe.PaymentIntent.create(
    amount=1000,
    currency='usd',
    automatic_tax={'enabled': True}
)
```

### 5. Send Email Receipts

```python
# Configure in Stripe Dashboard:
# Settings > Customer emails > Check "Successful payments"
```

---

## Part 13: Cost Structure

### Stripe Fees (US)

- **Online payments**: 2.9% + $0.30 per transaction
- **International cards**: +1.5%
- **Currency conversion**: +1%
- **Stripe Connect**: No additional fee
- **Payouts**: Free (ACH), $2 (instant)
- **Disputes**: $15 (refunded if won)

### Example Costs

**$50 sale**:
- Stripe fee: $50 × 0.029 + $0.30 = $1.75
- Net revenue: $48.25
- Effective fee: 3.5%

**$150 sale**:
- Stripe fee: $150 × 0.029 + $0.30 = $4.65
- Net revenue: $145.35
- Effective fee: 3.1%

**$1,000 sale**:
- Stripe fee: $1,000 × 0.029 + $0.30 = $29.30
- Net revenue: $970.70
- Effective fee: 2.93%

### Optimization Tips

1. **Encourage higher cart values** (fees are % + fixed)
2. **Accept local payment methods** (lower fees in some countries)
3. **Negotiate custom pricing** (if >$1M/year in volume)
4. **Use ACH/bank transfers** (0.8%, max $5 per transaction)

---

## Part 14: Resources

### Official Documentation

- Stripe API Docs: https://stripe.com/docs/api
- Webhooks Guide: https://stripe.com/docs/webhooks
- Connect Docs: https://stripe.com/docs/connect
- Testing Guide: https://stripe.com/docs/testing

### Stripe Dashboard Links

- Test Mode: https://dashboard.stripe.com/test/dashboard
- Live Mode: https://dashboard.stripe.com/dashboard
- API Keys: https://dashboard.stripe.com/apikeys
- Webhooks: https://dashboard.stripe.com/webhooks
- Products: https://dashboard.stripe.com/products
- Payments: https://dashboard.stripe.com/payments

### Support

- Stripe Support: https://support.stripe.com
- Stripe Status: https://status.stripe.com
- Community: https://github.com/stripe

---

## Quick Start Summary

**5-Minute Setup** (Test Mode):

```bash
# 1. Get API keys from dashboard
export POLAR_STRIPE_SECRET_KEY=sk_test_...
export POLAR_STRIPE_PUBLISHABLE_KEY=pk_test_...

# 2. Set up webhooks (use Stripe CLI for local dev)
stripe listen --forward-to localhost:8000/v1/integrations/stripe/webhook
export POLAR_STRIPE_WEBHOOK_SECRET=whsec_...

# 3. Add to .env file
echo "POLAR_STRIPE_SECRET_KEY=$POLAR_STRIPE_SECRET_KEY" >> server/.env
echo "POLAR_STRIPE_PUBLISHABLE_KEY=$POLAR_STRIPE_PUBLISHABLE_KEY" >> server/.env
echo "POLAR_STRIPE_WEBHOOK_SECRET=$POLAR_STRIPE_WEBHOOK_SECRET" >> server/.env

# 4. Start API
cd server
uv run task api

# 5. Test
curl http://localhost:8000/v1/integrations/stripe/health
```

✅ **Done!** Stripe is configured and ready for AgentPay!

---

**Last Updated**: 2025-11-17
**Next Review**: When deploying to production

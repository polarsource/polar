# AgentPay Merchant Onboarding Guide

**Purpose**: Complete guide for onboarding new merchants to AgentPay
**Audience**: Platform administrators and merchant success teams
**Time**: 30-45 minutes per merchant

---

## Table of Contents

1. [Pre-Onboarding](#pre-onboarding)
2. [Merchant Registration](#merchant-registration)
3. [Product Catalog Import](#product-catalog-import)
4. [Agent Configuration](#agent-configuration)
5. [Payment Setup](#payment-setup)
6. [Widget Integration](#widget-integration)
7. [Testing & Validation](#testing--validation)
8. [Go Live](#go-live)
9. [Training & Support](#training--support)

---

## Pre-Onboarding

### 1. Merchant Requirements Checklist

Before onboarding, ensure the merchant has:

- [ ] **Business Information**
  - Legal business name
  - Business registration number
  - Tax ID / EIN
  - Business address
  - Business email and phone

- [ ] **Product Information**
  - Product catalog (CSV, JSON, or API access)
  - Product images and descriptions
  - Pricing information
  - Inventory data
  - Product categories/tags

- [ ] **Technical Requirements**
  - Website URL (where widget will be installed)
  - Technical contact (email)
  - Access to website code (for widget installation)
  - Stripe account (or willingness to create one)

- [ ] **Business Requirements**
  - Expected conversation volume (estimate)
  - Target conversion rate goals
  - Average order value
  - Operating hours/timezone
  - Customer service policies (refunds, returns, etc.)

### 2. Information Collection

Use the following template to collect merchant information:

```json
{
  "business": {
    "name": "Acme Running Shoes",
    "slug": "acme-running",
    "email": "hello@acmerunning.com",
    "phone": "+1-555-0100",
    "website": "https://acmerunning.com",
    "address": {
      "line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "US"
    },
    "tax_id": "12-3456789",
    "industry": "retail"
  },
  "technical": {
    "contact_email": "dev@acmerunning.com",
    "platform": "shopify",
    "api_access": true
  },
  "expectations": {
    "monthly_visitors": 50000,
    "current_conversion_rate": 0.02,
    "target_conversion_rate": 0.035,
    "average_order_value": 89
  }
}
```

---

## Merchant Registration

### 3. Create Organization (API)

Use the AgentPay API to create a new organization:

```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Acme Running Shoes",
    "slug": "acme-running",
    "email": "hello@acmerunning.com",
    "website": "https://acmerunning.com",
    "settings": {
      "timezone": "America/Los_Angeles",
      "currency": "USD",
      "language": "en"
    }
  }'
```

**Response**:
```json
{
  "id": "org_abc123xyz",
  "name": "Acme Running Shoes",
  "slug": "acme-running",
  "created_at": "2025-11-17T10:00:00Z",
  "status": "active"
}
```

Save the `organization_id` for all subsequent steps.

### 4. Add Organization Settings

Configure organization-specific settings:

```bash
curl -X PATCH https://api.yourdomain.com/api/v1/organizations/org_abc123xyz \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "settings": {
      "business_hours": {
        "timezone": "America/Los_Angeles",
        "monday": {"start": "09:00", "end": "18:00"},
        "tuesday": {"start": "09:00", "end": "18:00"},
        "wednesday": {"start": "09:00", "end": "18:00"},
        "thursday": {"start": "09:00", "end": "18:00"},
        "friday": {"start": "09:00", "end": "18:00"},
        "saturday": {"start": "10:00", "end": "16:00"},
        "sunday": "closed"
      },
      "return_policy": "30-day return policy on all products",
      "shipping_policy": "Free shipping on orders over $100",
      "support_email": "support@acmerunning.com"
    }
  }'
```

---

## Product Catalog Import

### 5. Import Products

#### Option A: CSV Import

Prepare CSV file with columns:
```csv
id,name,description,price,category,image_url,in_stock
prod_001,Air Runner Pro,"Lightweight running shoes for professionals",129.99,shoes,https://...,true
prod_002,Trail Blazer,"All-terrain trail running shoes",149.99,shoes,https://...,true
```

Import via API:
```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/products/import \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "file=@products.csv" \
  -F "format=csv"
```

#### Option B: JSON Bulk Import

```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/products/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "products": [
      {
        "external_id": "prod_001",
        "name": "Air Runner Pro",
        "description": "Lightweight running shoes for professionals. Features breathable mesh upper, responsive cushioning, and durable rubber outsole.",
        "price": {
          "amount": 12999,
          "currency": "USD"
        },
        "category": "shoes",
        "tags": ["running", "lightweight", "professional"],
        "images": [
          {
            "url": "https://acmerunning.com/images/air-runner-pro.jpg",
            "alt": "Air Runner Pro - Side View"
          }
        ],
        "variants": [
          {"size": "8", "color": "black", "sku": "AR-BLK-8"},
          {"size": "9", "color": "black", "sku": "AR-BLK-9"},
          {"size": "10", "color": "black", "sku": "AR-BLK-10"}
        ],
        "inventory": {
          "in_stock": true,
          "quantity": 50
        },
        "metadata": {
          "weight": "8.5 oz",
          "drop": "8mm",
          "type": "neutral"
        }
      }
    ]
  }'
```

#### Option C: API Integration

For platforms like Shopify, WooCommerce, etc., use the integration API:

```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/integrations/shopify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "shop_url": "acme-running.myshopify.com",
    "access_token": "shpat_...",
    "sync_products": true,
    "sync_inventory": true,
    "sync_interval": 3600
  }'
```

### 6. Index Products for RAG

After importing products, index them for semantic search:

```bash
# Via API
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/products/index \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Or via worker script
docker-compose -f docker-compose.prod.yml exec worker \
  uv run python -m polar.scripts.index_products \
  --organization-id org_abc123xyz
```

**Indexing Progress**:
- 10 products: ~5 seconds
- 100 products: ~30 seconds
- 1,000 products: ~3 minutes
- 10,000 products: ~20 minutes

Verify indexing:
```bash
curl https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/products/index/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Agent Configuration

### 7. Create Sales Agent

Create a sales agent for the merchant:

```bash
curl -X POST https://api.yourdomain.com/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "organization_id": "org_abc123xyz",
    "name": "Acme Sales Agent",
    "type": "sales",
    "personality": "friendly, knowledgeable, and enthusiastic about running",
    "instructions": "You are a running shoe expert helping customers find the perfect shoes. Ask about their running style, distance, terrain, and any specific needs. Always suggest products that match their requirements.",
    "tools": [
      "search_products",
      "get_product_details",
      "create_checkout_link"
    ],
    "rules": [
      "Never suggest products that are out of stock",
      "Always mention free shipping on orders over $100",
      "Explain the 30-day return policy when discussing purchases",
      "If a customer mentions pain or injury, recommend consulting a professional",
      "Keep responses concise and conversational"
    ],
    "greeting_message": "Hi! 👋 I'm here to help you find the perfect running shoes. What kind of running do you do?",
    "settings": {
      "max_conversation_length": 50,
      "enable_streaming": true,
      "enable_typing_indicator": true,
      "response_style": "casual",
      "temperature": 0.7
    }
  }'
```

**Response**:
```json
{
  "id": "agent_xyz789",
  "organization_id": "org_abc123xyz",
  "name": "Acme Sales Agent",
  "type": "sales",
  "status": "active",
  "created_at": "2025-11-17T10:15:00Z"
}
```

### 8. Customize Agent Personality (Optional)

Fine-tune agent personality based on merchant brand:

**Luxury/Premium Brand**:
```json
{
  "personality": "sophisticated, professional, and detail-oriented",
  "response_style": "formal",
  "temperature": 0.6,
  "instructions": "You represent a premium running brand. Emphasize quality, craftsmanship, and performance. Use elegant language."
}
```

**Budget/Value Brand**:
```json
{
  "personality": "helpful, straightforward, and value-focused",
  "response_style": "casual",
  "temperature": 0.7,
  "instructions": "Help customers find great running shoes at affordable prices. Highlight value and practicality."
}
```

**Technical/Performance Brand**:
```json
{
  "personality": "expert, data-driven, and performance-focused",
  "response_style": "technical",
  "temperature": 0.5,
  "instructions": "You're a running biomechanics expert. Use technical terminology. Discuss features like drop, stack height, energy return, etc."
}
```

---

## Payment Setup

### 9. Stripe Connect Integration

Set up Stripe Connect for the merchant:

#### Step 1: Create Stripe Connect Account

```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/payment/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "type": "standard",
    "country": "US",
    "email": "hello@acmerunning.com"
  }'
```

**Response**:
```json
{
  "account_id": "acct_stripe123",
  "onboarding_url": "https://connect.stripe.com/setup/s/acct_stripe123",
  "status": "pending"
}
```

#### Step 2: Send Onboarding Link

Send the `onboarding_url` to the merchant:

```text
Subject: Complete Your Payment Setup

Hi Acme Running Shoes team,

To start accepting payments through AgentPay, please complete your Stripe Connect setup:

https://connect.stripe.com/setup/s/acct_stripe123

This will take about 5-10 minutes and requires:
- Business verification details
- Bank account for payouts
- Identity verification (for business owner)

Once complete, you'll be able to accept payments through your sales agent!

Questions? Contact us at support@agentpay.com

Best,
AgentPay Team
```

#### Step 3: Verify Connection

Check connection status:
```bash
curl https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/payment/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 10. Configure Payment Settings

```bash
curl -X PATCH https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/payment/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "currency": "USD",
    "payment_methods": ["card", "apple_pay", "google_pay"],
    "checkout_mode": "payment",
    "success_url": "https://acmerunning.com/order/success",
    "cancel_url": "https://acmerunning.com/cart",
    "shipping": {
      "enabled": true,
      "rates": [
        {"name": "Standard Shipping", "amount": 599, "delivery_days": 5},
        {"name": "Express Shipping", "amount": 1599, "delivery_days": 2}
      ],
      "free_shipping_threshold": 10000
    },
    "tax": {
      "enabled": true,
      "automatic": true
    }
  }'
```

---

## Widget Integration

### 11. Generate Widget Embed Code

Generate customized widget code for the merchant:

```javascript
<!-- AgentPay Chat Widget -->
<div id="agentpay-chat-root"></div>

<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom/client": "https://esm.sh/react-dom@18/client"
  }
}
</script>

<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgentPayChat } from 'https://cdn.agentpay.com/widget/v1/agentpay-chat.js';

const root = createRoot(document.getElementById('agentpay-chat-root'));
root.render(
  React.createElement(AgentPayChat, {
    organizationId: 'org_abc123xyz',
    agentType: 'sales',
    apiEndpoint: 'https://api.agentpay.com/api/v1/agent',
    position: 'bottom-right',
    primaryColor: '#10b981',
    welcomeMessage: 'Hi! 👋 I\'m here to help you find the perfect running shoes. What kind of running do you do?',
    enableStreaming: true,
    enableTypingIndicator: true,
    onCheckout: (url) => {
      window.location.href = url;
    },
    onConversationStart: (conversationId) => {
      console.log('Conversation started:', conversationId);
      // Optional: Track with analytics
      if (window.gtag) {
        gtag('event', 'conversation_start', {
          conversation_id: conversationId
        });
      }
    }
  })
);
</script>
```

### 12. Installation Instructions

Send these instructions to the merchant's technical team:

```markdown
# AgentPay Widget Installation

## Installation Steps

1. **Add Widget Code**
   - Copy the code snippet below
   - Paste it just before the closing `</body>` tag on all pages

2. **Customize (Optional)**
   - `primaryColor`: Match your brand color (hex code)
   - `position`: Choose 'bottom-right', 'bottom-left', 'top-right', or 'top-left'
   - `welcomeMessage`: Customize the greeting

3. **Test**
   - Visit your website
   - Click the chat button (bottom-right corner)
   - Send a test message: "I need running shoes"
   - Verify agent responds correctly

## Code Snippet

[Insert generated code above]

## Troubleshooting

**Widget not appearing?**
- Check browser console for errors
- Verify script is before `</body>`
- Clear browser cache

**Agent not responding?**
- Check internet connection
- Verify organizationId is correct
- Contact support@agentpay.com

## Next Steps

After installation:
1. Test conversation flow
2. Test checkout process
3. Monitor first 10 conversations
4. Review conversation quality
5. Provide feedback for improvements
```

### 13. Platform-Specific Integration

#### Shopify
```liquid
<!-- In theme.liquid, before </body> -->
{% if template != 'checkout' %}
  {{ 'agentpay-widget.js' | asset_url | script_tag }}
  <script>
    AgentPay.init({
      organizationId: '{{ settings.agentpay_org_id }}',
      primaryColor: '{{ settings.agentpay_color }}'
    });
  </script>
{% endif %}
```

#### WordPress/WooCommerce
```php
// In functions.php or custom plugin
add_action('wp_footer', 'agentpay_widget');
function agentpay_widget() {
    if (!is_checkout()) {
        echo '[Insert widget code]';
    }
}
```

#### Custom/React
```jsx
import { AgentPayChat } from '@agentpay/chat';

function App() {
  return (
    <div className="app">
      <YourContent />
      <AgentPayChat
        organizationId="org_abc123xyz"
        agentType="sales"
        primaryColor="#10b981"
      />
    </div>
  );
}
```

---

## Testing & Validation

### 14. Pre-Launch Testing

Complete testing checklist with merchant:

#### Conversation Flow Testing
- [ ] **Greeting**: Send "Hello" → Verify welcome message
- [ ] **Product Query**: "I need trail running shoes" → Verify product suggestions
- [ ] **Product Details**: "Tell me more about [product]" → Verify details shown
- [ ] **Price Negotiation**: "Can you do better on price?" → Verify handling
- [ ] **Out of Stock**: Ask about unavailable product → Verify alternative suggested
- [ ] **Checkout Intent**: "I want to buy it" → Verify checkout link generated
- [ ] **General Question**: "What's your return policy?" → Verify policy explained

#### Technical Testing
- [ ] **Desktop**: Test on Chrome, Firefox, Safari
- [ ] **Mobile**: Test on iOS Safari, Android Chrome
- [ ] **Tablet**: Test on iPad, Android tablet
- [ ] **Streaming**: Verify responses stream (not delayed)
- [ ] **Typing Indicator**: Verify indicator shows when agent is responding
- [ ] **WebSocket**: Verify connection is stable (no disconnects)
- [ ] **CORS**: Verify widget loads correctly on merchant domain

#### Payment Testing
- [ ] **Checkout Link**: Verify Stripe checkout opens
- [ ] **Test Payment**: Complete test purchase with test card (4242424242424242)
- [ ] **Success Flow**: Verify redirect to success page after payment
- [ ] **Cancel Flow**: Verify redirect to cart on cancel
- [ ] **Shipping**: Verify shipping options display correctly
- [ ] **Tax**: Verify tax calculation is correct
- [ ] **Receipt**: Verify email receipt sent

#### Analytics Testing
- [ ] **Conversation Start**: Verify event tracked
- [ ] **Message Sent**: Verify events logged
- [ ] **Checkout Created**: Verify event tracked
- [ ] **Purchase Completed**: Verify conversion tracked

### 15. Quality Assurance

Review first 10 conversations with merchant:

```bash
curl https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/conversations?limit=10 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Check for:
- [ ] Agent responses are accurate and helpful
- [ ] Product recommendations are relevant
- [ ] Agent personality matches brand
- [ ] Response times are acceptable (<2s)
- [ ] No errors or failed messages
- [ ] Checkout links work correctly

---

## Go Live

### 16. Launch Checklist

- [ ] All products imported and indexed
- [ ] Agent configured and tested
- [ ] Stripe Connect account verified
- [ ] Widget installed on production site
- [ ] All tests passed
- [ ] Merchant trained on dashboard
- [ ] Support contact established
- [ ] Analytics tracking configured

### 17. Soft Launch (Recommended)

Start with limited exposure:

```javascript
// Show widget to 10% of visitors
if (Math.random() < 0.1) {
  // Load AgentPay widget
}
```

Monitor for 24-48 hours:
- [ ] Conversation quality
- [ ] Error rates
- [ ] Conversion rates
- [ ] Customer feedback

### 18. Full Launch

After successful soft launch:
- [ ] Remove traffic limiting
- [ ] Enable widget for all visitors
- [ ] Announce to customers (email, social media)
- [ ] Monitor metrics closely

---

## Training & Support

### 19. Merchant Dashboard Training

Train merchant team on dashboard:

#### Key Features
- **Conversations**: View active and past conversations
- **Analytics**: Conversation metrics, conversion rates, revenue
- **Products**: Manage catalog, update inventory
- **Agent Settings**: Adjust personality, rules, greeting
- **Payment Settings**: Configure Stripe, shipping, tax

#### Training Session Agenda (30 minutes)
1. Dashboard overview (5 min)
2. Viewing conversations (5 min)
3. Understanding analytics (10 min)
4. Managing products (5 min)
5. Adjusting agent settings (3 min)
6. Q&A (2 min)

### 20. Ongoing Support

Provide merchant with:

#### Support Resources
- [ ] Knowledge base URL
- [ ] Video tutorials
- [ ] Email support: support@agentpay.com
- [ ] Slack/Discord community (optional)
- [ ] Dedicated account manager (enterprise)

#### SLA Commitments
- Email response: <24 hours
- Critical issues: <4 hours
- Non-critical issues: <48 hours
- Uptime guarantee: 99.9%

### 21. Success Metrics

Track and share with merchant:

#### Weekly Reports
- **Conversations**: Total, active, completed
- **Conversion Rate**: Checkout sessions / conversations
- **Revenue**: Total sales via AgentPay
- **AOV**: Average order value
- **Response Time**: Average agent response time
- **Customer Satisfaction**: Based on feedback

#### Monthly Business Reviews
- Performance vs. goals
- Conversation quality analysis
- Optimization recommendations
- Feature requests
- Cost analysis (LLM, infrastructure)

---

## Onboarding Checklist Summary

**Pre-Onboarding** (Day 0):
- [ ] Collect merchant information
- [ ] Review requirements
- [ ] Schedule onboarding call

**Registration** (Day 1):
- [ ] Create organization
- [ ] Configure settings
- [ ] Add team members

**Setup** (Days 2-3):
- [ ] Import products
- [ ] Index for RAG
- [ ] Create and configure agent
- [ ] Set up Stripe Connect
- [ ] Configure payment settings

**Integration** (Days 4-5):
- [ ] Generate widget code
- [ ] Send installation instructions
- [ ] Assist with installation
- [ ] Test widget on production

**Testing** (Days 6-7):
- [ ] Complete testing checklist
- [ ] Review first conversations
- [ ] Fix any issues
- [ ] Train merchant team

**Launch** (Day 8):
- [ ] Soft launch (10% traffic)
- [ ] Monitor 24-48 hours
- [ ] Full launch
- [ ] Ongoing support

**Total Time**: 7-10 days from start to full launch

---

## Appendix

### A. Sample Products CSV

```csv
id,name,description,price,category,tags,image_url,in_stock,variants
prod_001,Air Runner Pro,Lightweight running shoes for professionals,129.99,shoes,"running,lightweight,professional",https://...,true,"8:black,9:black,10:black"
prod_002,Trail Blazer,All-terrain trail running shoes,149.99,shoes,"trail,durable,grip",https://...,true,"8:gray,9:gray,10:gray"
```

### B. Webhook Configuration

For advanced integrations, configure webhooks to sync data:

```bash
curl -X POST https://api.yourdomain.com/api/v1/organizations/org_abc123xyz/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "url": "https://acmerunning.com/webhooks/agentpay",
    "events": [
      "conversation.started",
      "conversation.completed",
      "checkout.created",
      "payment.succeeded"
    ],
    "secret": "whsec_..."
  }'
```

### C. Custom Integrations

For custom requirements, use the AgentPay API:
- **Inventory Sync**: POST `/products/sync` every 1 hour
- **Order Export**: GET `/orders` for fulfillment
- **Customer Data**: POST `/customers` for CRM sync
- **Analytics**: GET `/analytics` for custom dashboards

---

**Status**: Ready for merchant onboarding ✅
**Next**: Begin onboarding first merchant following this guide

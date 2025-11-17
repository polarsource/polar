# AgentPay: Polar Review + Embedded Chat Implementation Plan

**Document Version:** 1.0
**Date:** 2025-01-17
**Analysis Type:** Technical Architecture Review & Implementation Strategy
**Author:** Senior Software Architect, AI Systems Engineer, Payments Infrastructure Specialist

---

## Executive Summary

### Key Findings

**Polar/Flowpay Assessment:**
- **Architecture Quality:** 9/10 - Production-grade FastAPI/SQLAlchemy system with excellent modular design
- **Payment Infrastructure:** Best-in-class Stripe integration with comprehensive transaction accounting
- **Reusability for AgentPay:** 60-70% of payment core is directly reusable with targeted extensions
- **Primary Gap:** Built for static e-commerce; requires conversational commerce layer

**Strategic Recommendation:** **Build AgentPay on Polar Foundation** ⭐

**Why:**
1. **Time-to-Market:** 8-10 weeks to MVP vs 16-20 weeks from scratch
2. **Risk Reduction:** Proven payment processing (live in production)
3. **Financial Foundation:** Double-entry accounting, multi-currency, tax compliance already solved
4. **Extension Path:** Clean modular architecture allows surgical additions without rewrites

**What You Get:**
- ✅ Stripe integration (payments, subscriptions, refunds, webhooks)
- ✅ Multi-tenant architecture (organization-scoped)
- ✅ Transaction accounting system
- ✅ Customer management with OAuth
- ✅ Product/pricing infrastructure
- ✅ Background job processing (Dramatiq)
- ✅ API authentication & authorization

**What You Build:**
- 🔨 Agent Core (conversation engine)
- 🔨 RAG knowledge system
- 🔨 Multi-agent orchestration
- 🔨 Conversational checkout flow
- 🔨 Dynamic pricing negotiation
- 🔨 Astro chat widget
- 🔨 WhatsApp/messaging integrations

**Timeline:** 90 days to production-ready conversational commerce platform

**Cost Savings:** ~$120,000-$180,000 in engineering time (4-6 months of payment infrastructure work avoided)

---

## 1. Polar Technical Review

### 1.1 High-Level Architecture

**Technology Stack:**

**Backend:**
```
Python 3.12+ (async/await first-class)
├── FastAPI (web framework)
├── SQLAlchemy 2.0 (ORM)
├── PostgreSQL (primary database)
├── Redis (cache + job queue)
├── Dramatiq (background workers)
├── Alembic (migrations)
└── Stripe (payment processor)
```

**Frontend:**
```
TypeScript + React 19
├── Next.js 16 (App Router)
├── TanStack Query (data fetching)
├── Tailwind CSS 4 (styling)
├── Radix UI (components)
└── Stripe Elements (payment forms)
```

**Infrastructure:**
```
Docker Compose (local dev)
├── PostgreSQL 15
├── Redis 7
└── MinIO (S3-compatible storage)
```

**Architecture Pattern:**
```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                            │
│  FastAPI Endpoints → Auth Middleware → Request Validation   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Service Layer                           │
│   Business Logic → Authorization → Domain Rules             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Repository Layer                           │
│   Query Building → Filtering → Eager Loading                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Data Layer                              │
│   PostgreSQL → SQLAlchemy Models → Transactions             │
└─────────────────────────────────────────────────────────────┘

         Background Processing (Dramatiq Workers)
                         ▲
                         │
         ┌───────────────┼────────────────┐
         │               │                │
    Webhooks         Scheduled        Async Tasks
   (Stripe)           Jobs           (emails, etc.)
```

### 1.2 Module Organization (58 Business Modules)

**Core Payment Modules:**
- `payment/` - Payment processing
- `transaction/` - Double-entry accounting (17,930 lines - complex financial ledger)
- `order/` - Order management (2,077 lines of service logic)
- `checkout/` - Checkout sessions (2,149 lines - sophisticated flow)
- `subscription/` - Recurring billing (2,821 lines - most complex module)
- `refund/` - Refund processing
- `payout/` - Merchant payouts

**Product/Customer Modules:**
- `product/` - Product catalog
- `customer/` - Customer management (9,248 lines in model - rich customer data)
- `discount/` - Coupon/discount system
- `benefit/` - Entitlements/access control

**Infrastructure Modules:**
- `organization/` - Multi-tenant root entity
- `user/` - User accounts + OAuth
- `webhook/` - Outbound webhooks to merchants
- `event/` - Analytics/audit trail (10,017 lines)
- `integrations/stripe/` - Stripe integration (comprehensive)

**Supporting:**
- `kit/` - Shared utilities (pagination, sorting, DB helpers)
- `worker/` - Dramatiq job system
- `backoffice/` - Admin interface

### 1.3 What Can Be Reused for AgentPay

**Directly Reusable (90-100%):**

1. **Payment Processing Infrastructure**
   - Stripe Payment Intent flow
   - Webhook handling with retry logic
   - Payment method storage
   - 3D Secure authentication
   - Fraud detection integration
   - **Value:** 3-4 months of engineering work saved

2. **Transaction Accounting System**
   - Double-entry bookkeeping
   - Multi-currency support
   - Fee calculation (processor + platform)
   - Refund handling
   - **Value:** 2-3 months of financial engineering saved

3. **Customer Management**
   - Customer entity with billing details
   - OAuth integration (GitHub, Discord)
   - Payment method storage
   - Tax ID validation
   - **Extend:** Add phone numbers for WhatsApp, conversation history

4. **Multi-Tenant Architecture**
   - Organization-scoped data isolation
   - Row-level security in queries
   - User-organization membership
   - **Perfect for:** Multiple merchants using AgentPay

5. **Background Job System**
   - Async task processing
   - Webhook delivery with retries
   - Scheduled jobs (cron-like)
   - **Use for:** LLM processing, message delivery, analytics

6. **API Infrastructure**
   - Authentication (tokens, sessions, OAuth2)
   - Authorization (scope-based permissions)
   - Pagination, sorting, filtering
   - OpenAPI documentation
   - **Extend:** Add WebSocket/SSE for real-time chat

**Reusable with Modifications (60-80%):**

1. **Product Catalog**
   - Product models with variants
   - Pricing tiers (fixed, custom, metered, seat-based)
   - **Add:** Conversational descriptions, voice-optimized metadata

2. **Checkout Flow**
   - Session management
   - Tax calculation (Stripe Tax)
   - Discount application
   - **Extend:** Multi-turn conversation support, longer TTLs, negotiation state

3. **Order Management**
   - Order lifecycle
   - Line items
   - Invoice generation
   - **Add:** Conversation context, negotiation history

**Not Directly Reusable (Rebuild Required):**

1. **Frontend (Next.js)**
   - AgentPay needs Astro-compatible chat widget
   - Can extract iframe embed pattern
   - React components not portable

2. **Admin Dashboard**
   - Polar's dashboard is for SaaS products
   - AgentPay needs merchant conversation monitoring

### 1.4 What Must Be Modified

**Critical Modifications:**

1. **Checkout Session Model**
   ```python
   # Current: Short-lived (15 min), single-page flow
   class Checkout:
       expires_at: datetime  # 15 minutes
       status: open → confirmed → succeeded

   # AgentPay Needs: Long-lived, multi-turn conversations
   class ConversationCheckout(Checkout):
       conversation_id: UUID
       message_history: list[dict]
       negotiation_state: dict  # Offers, counteroffers
       commitment_level: enum  # browsing → interested → ready
       expires_at: datetime  # Days, not minutes
       agent_context: dict  # Customer signals, pain points
   ```

2. **Product Model - Add Conversational Metadata**
   ```python
   class Product:
       # Existing fields...

       # Add for AgentPay:
       conversational_description: str  # Agent-friendly description
       voice_description: str  # Voice-optimized (short)
       sales_objections: list[str]  # Common objections
       upsell_triggers: list[str]  # When to suggest
       allow_dynamic_pricing: bool
       pricing_bounds: dict  # {"min": 4000, "max": 10000}
   ```

3. **Customer Model - Add Communication Channels**
   ```python
   class Customer:
       # Existing: email, stripe_customer_id, oauth_accounts

       # Add for AgentPay:
       phone_number: str  # WhatsApp primary identifier
       whatsapp_id: str
       telegram_id: str
       preferred_channel: enum
       conversation_history: relationship
   ```

4. **Pricing System - Dynamic Negotiation**
   ```python
   # New model for AI-generated prices
   class AgentPriceOffer:
       base_price: int
       adjustments: list[PriceAdjustment]
       final_price: int
       reasoning: str  # "15% off for bulk"
       valid_until: datetime
       requires_merchant_approval: bool
   ```

### 1.5 What Parts Are Useless for AgentPay

**Remove/Ignore:**

1. **Subscription Products** (for MVP)
   - Polar has complex subscription billing (2,821 lines)
   - AgentPay MVP focuses on one-time purchases
   - **Save for:** Phase 2 (recurring AI agent subscriptions)

2. **GitHub Integration**
   - Polar sells to developers (GitHub repos as products)
   - AgentPay sells physical/digital goods
   - **Remove:** GitHub-specific code

3. **Benefit Grant System**
   - Polar grants access to private repos, Discord roles
   - AgentPay doesn't need digital entitlements (for MVP)
   - **Keep:** Order confirmation, shipping tracking

4. **Issue Funding**
   - Polar-specific feature (fund GitHub issues)
   - Not relevant to AgentPay

5. **Ads System**
   - Polar has ads/sponsorship features
   - Not needed for conversational commerce

6. **Frontend Dashboard**
   - Polar's merchant dashboard is product-centric
   - AgentPay needs conversation-centric dashboard
   - **Rebuild:** Merchant dashboard for monitoring agent conversations

**Estimated Code Reduction:** ~30-40% of Polar codebase not needed for AgentPay MVP

### 1.6 Complexity Assessment

**Overall Complexity: Medium-High**

**Well-Managed Complexity:**
- ✅ Consistent patterns across all modules
- ✅ Clear separation of concerns (service/repository)
- ✅ Type safety (Python type hints, Pydantic validation)
- ✅ Comprehensive error handling

**Areas of High Complexity:**

1. **Subscription Service** (2,821 lines)
   - Handles recurring billing, proration, trials
   - Complex state machine
   - **Verdict:** Skip for MVP

2. **Transaction Model** (17,930 lines)
   - Double-entry accounting with self-referential relationships
   - Multiple transaction types
   - **Verdict:** Use as-is (battle-tested)

3. **Event System** (10,017 lines)
   - Analytics, webhooks, audit trail
   - Complex event schemas
   - **Verdict:** Leverage for conversation analytics

4. **Customer Model** (9,248 lines)
   - OAuth, payment methods, metadata
   - **Verdict:** Extend with communication channels

**Complexity Metrics:**
- **67 SQLAlchemy models** (some 10K+ lines each)
- **235 database migrations** (active development)
- **21 modules with background tasks**
- **97 granular permission scopes**

**Assessment:** High complexity is justified by feature richness. For AgentPay, we reduce complexity by:
- Skipping subscriptions (MVP)
- Removing GitHub-specific features
- Simplifying benefit grants
- Using only essential modules

### 1.7 Stability, Maintainability, and Long-Term Risks

**Stability: High ✅**

**Evidence:**
- 235 migrations show continuous refinement
- Comprehensive error handling
- Webhook retry logic
- Idempotency keys for Stripe
- Transaction rollback on failures

**Risks:**
- Auto-commit pattern (`session.commit()` at request end) may hide issues
  - **Mitigation:** Explicit `session.flush()` for critical paths
- Large model files (10K+ lines) hard to navigate
  - **Mitigation:** Keep new models small, focused

**Maintainability: Medium-High ⚠️**

**Strengths:**
- Consistent patterns (easy to onboard)
- Type safety (catch bugs early)
- Good separation of concerns

**Weaknesses:**
- JSONB overuse (schema hidden in JSON)
- Some services are 2,000+ lines (too large)
- Circular import complexity (many `TYPE_CHECKING` blocks)

**Long-Term Risks:**

1. **Stripe Lock-In (HIGH RISK)**
   - Polar is tightly coupled to Stripe
   - No abstraction layer for payment processors
   - **AgentPay Mitigation:** Build adapter pattern for PIX, Wise, Stripe

2. **Monolithic Architecture (MEDIUM RISK)**
   - Single deployment (no microservices)
   - Scaling requires vertical scaling
   - **AgentPay Mitigation:** Agent Core can run as separate service

3. **Database Growth (MEDIUM RISK)**
   - All tenants in single database
   - Large JSONB columns grow over time
   - **AgentPay Mitigation:** Conversation history archival strategy

4. **Python Performance (LOW RISK)**
   - Python is slower than Go/Rust for high-throughput
   - **Mitigation:** Async/await + connection pooling handles 1K+ req/sec

5. **Frontend Coupling (LOW RISK)**
   - Next.js-specific patterns
   - **AgentPay:** We're rebuilding with Astro anyway

**Longevity Assessment:**
- Polar is actively maintained (recent migrations)
- Modern stack (Python 3.12, SQLAlchemy 2.0, FastAPI)
- Community support for all dependencies
- **Verdict:** 5+ year lifespan without major rewrites

### 1.8 Integration with Astro-Based Product

**Difficulty: Medium ⭐⭐⭐☆☆**

**Integration Strategy:**

```
┌─────────────────────────────────────────────────────────────┐
│              Merchant's Astro E-Commerce Site                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  <script src="agentpay-widget.js"></script>        │     │
│  │  <div data-agentpay-chat />                        │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    Embed Script (Vanilla JS)
                            │
                ┌───────────▼────────────┐
                │  iframe (Chat Widget)  │
                │  Can be React/Svelte   │
                │  Hosted on AgentPay    │
                └───────────┬────────────┘
                            │
                    PostMessage API
                            │
        ┌───────────────────▼─────────────────────┐
        │     AgentPay Backend (Polar-based)      │
        │                                         │
        │  ┌─────────────┐    ┌───────────────┐  │
        │  │ Agent Core  │◄───┤ FastAPI API   │  │
        │  │ (Anthropic/ │    │ (Polar Base)  │  │
        │  │  OpenAI)    │    └───────┬───────┘  │
        │  └──────┬──────┘            │          │
        │         │                   │          │
        │  ┌──────▼──────┐    ┌───────▼───────┐  │
        │  │ RAG System  │    │ Payment       │  │
        │  │ (Embeddings)│    │ (Stripe/PIX)  │  │
        │  └─────────────┘    └───────────────┘  │
        │                                         │
        └─────────────────────────────────────────┘
```

**Reuse Polar's Embed Pattern:**
- File: `/home/user/flowpay/clients/packages/checkout/src/embed.ts` (402 lines)
- Already framework-agnostic vanilla JavaScript
- Creates iframe overlay
- PostMessage communication
- Works with any static site (Astro, Hugo, Jekyll, etc.)

**Adaptation Required:**
```diff
  // Polar embed.ts (checkout)
  class EmbedCheckout {
    static create(checkoutUrl, theme) {
+     // AgentPay: Open chat widget instead of checkout
-     // Load checkout page in iframe
+     // Load chat interface in iframe
    }
  }
```

**API Integration:**
```typescript
// Astro site can call AgentPay API directly
import { AgentPayClient } from '@agentpay/sdk'

const client = new AgentPayClient({
  apiKey: import.meta.env.AGENTPAY_KEY,
  merchantId: 'merchant_123'
})

// Get product catalog for RAG context
const products = await client.products.list()
```

**Challenges:**

1. **Real-Time Communication**
   - Polar uses SSE for checkout updates
   - AgentPay chat needs bi-directional (WebSocket)
   - **Solution:** Add WebSocket support to FastAPI backend

2. **Authentication**
   - Polar uses customer sessions (1-hour TTL)
   - Chat needs longer sessions (multi-day conversations)
   - **Solution:** Extend session TTL, add refresh tokens

3. **State Management**
   - Astro is mostly static (SSG/SSR)
   - Chat widget needs stateful
   - **Solution:** All state in backend + iframe

**Integration Complexity by Approach:**

| Approach | Complexity | Polar Reuse | Best For |
|----------|-----------|-------------|----------|
| **Iframe embed** (recommended) | Low | 90% | Any static site |
| **Astro island (React)** | Medium | 70% | Astro-first merchants |
| **Full rebuild (Astro components)** | High | 40% | Full control |

**Recommendation:** Use iframe embed pattern (easiest, fastest, most compatible)

### 1.9 Apache 2.0 License - Commercial Use

**License:** Apache License 2.0

**Commercial Use: ✅ FULLY SAFE**

**What You Can Do:**
- ✅ Use commercially (build SaaS product)
- ✅ Modify source code
- ✅ Distribute modified versions
- ✅ Sublicense
- ✅ Use patents granted by contributors
- ✅ Keep modifications private (no copyleft)

**What You Must Do:**
- ⚠️ Include Apache 2.0 license text in distributions
- ⚠️ State significant changes if you distribute
- ⚠️ Preserve copyright notices
- ⚠️ Include NOTICE file if present

**What You Cannot Do:**
- ❌ Use Polar trademarks without permission
- ❌ Hold contributors liable

**Comparison to Other Licenses:**
```
GPL v3:   ❌ Copyleft (must open-source modifications)
AGPL v3:  ❌ Copyleft + network copyleft (SaaS must open-source)
MIT:      ✅ Similar to Apache (but no patent grant)
Apache 2: ✅ Best for commercial SaaS (patent protection)
```

**Why Apache 2.0 is Ideal for AgentPay:**
1. Patent grant protects you from contributor patent claims
2. No copyleft (modifications can stay private)
3. Commercial-friendly
4. Compatible with most other licenses
5. Used by Google, Meta, Apache Foundation

**Legal Obligations (Technical Interpretation):**

If you distribute AgentPay software:
```
/NOTICE.txt:
  This software includes code from Polar (https://github.com/polarsource/polar)
  Copyright Polar Contributors
  Licensed under Apache License 2.0
```

If you run AgentPay as SaaS (no distribution):
- No obligation to share code
- No obligation to mention Polar (but good practice)

**Verdict:** Apache 2.0 is perfect for commercial SaaS. No legal blockers.

---

## 2. Use Polar vs Build From Scratch: Detailed Comparison

### Comparison Matrix

| **Criterion** | **Option A: Build on Polar** | **Option B: Build from Scratch** |
|--------------|------------------------------|----------------------------------|
| **PROS** | | |
| Time to MVP | ⭐⭐⭐⭐⭐ 8-10 weeks | ⭐⭐☆☆☆ 16-20 weeks |
| Risk Level | ⭐⭐⭐⭐⭐ Low (proven system) | ⭐⭐☆☆☆ High (greenfield) |
| Payment Infrastructure | ⭐⭐⭐⭐⭐ Production-ready Stripe | ⭐⭐⭐☆☆ Must build from scratch |
| Multi-Currency | ⭐⭐⭐⭐⭐ Built-in | ⭐⭐⭐☆☆ Must implement |
| Tax Compliance | ⭐⭐⭐⭐⭐ Stripe Tax integrated | ⭐⭐☆☆☆ Must research & implement |
| Accounting | ⭐⭐⭐⭐⭐ Double-entry system | ⭐⭐☆☆☆ Must design & build |
| Multi-Tenancy | ⭐⭐⭐⭐⭐ Organization-scoped | ⭐⭐⭐☆☆ Design from scratch |
| Background Jobs | ⭐⭐⭐⭐⭐ Dramatiq ready | ⭐⭐⭐☆☆ Choose & integrate |
| API Auth | ⭐⭐⭐⭐⭐ OAuth2 + scopes | ⭐⭐⭐☆☆ Implement from scratch |
| Learning Curve | ⭐⭐⭐☆☆ Medium (understand Polar) | ⭐⭐⭐⭐⭐ Low (your architecture) |
| Flexibility | ⭐⭐⭐☆☆ Constrained by Polar patterns | ⭐⭐⭐⭐⭐ Total control |
| Code Ownership | ⭐⭐⭐⭐☆ Fork + extend | ⭐⭐⭐⭐⭐ 100% yours |
| **CONS** | | |
| Technical Debt | ⚠️ Inherit Polar's complexity | ✅ Clean slate |
| Stripe Lock-in | ⚠️ Tightly coupled to Stripe | ✅ Can design abstraction |
| Codebase Size | ⚠️ Large codebase to navigate | ✅ Minimal initial code |
| Unused Features | ⚠️ 30-40% of code irrelevant | ✅ Only what you need |
| Database Schema | ⚠️ Complex (67 models) | ✅ Lean schema |
| Update Dependencies | ⚠️ Must sync with Polar changes | ✅ Control all dependencies |
| **TOTALS** | | |
| **Development Time** | **8-10 weeks** | **16-20 weeks** |
| **Team Size Needed** | 2-3 engineers | 3-5 engineers |
| **Estimated Cost** | $80,000-$120,000 | $200,000-$300,000 |
| **Risk Score** | Low | Medium-High |

---

### Option A: Build AgentPay on Polar Foundation

**Technical Implementation:**

```
Fork Polar Repo
├── Remove: GitHub integration, subscriptions, ads
├── Add: Agent Core (conversation engine)
├── Add: RAG system (product knowledge)
├── Add: Multi-agent orchestration
├── Extend: Checkout (conversational flow)
├── Extend: Product (conversational metadata)
├── Extend: Customer (phone, WhatsApp ID)
├── Build: Astro chat widget (iframe embed)
└── Integrate: LLM providers (Anthropic, OpenAI)
```

**PROS:**

1. **Mature Payment Processing (⭐⭐⭐⭐⭐)**
   - Stripe integration battle-tested
   - Webhook handling with retry logic
   - Payment method storage + tokenization
   - 3D Secure authentication
   - Refund processing
   - Fraud detection hooks
   - **Value:** $60K-$80K engineering saved

2. **Financial Infrastructure (⭐⭐⭐⭐⭐)**
   - Double-entry transaction accounting
   - Multi-currency support (90+ currencies)
   - Platform fee calculations
   - Processor fee tracking
   - Payout management
   - Tax compliance (Stripe Tax API)
   - **Value:** $40K-$60K saved

3. **Multi-Tenant Architecture (⭐⭐⭐⭐⭐)**
   - Organization-scoped data isolation
   - User-organization memberships
   - Row-level security in queries
   - Perfect for SaaS: Multiple merchants on one platform
   - **Value:** $20K-$30K saved

4. **Background Job System (⭐⭐⭐⭐⭐)**
   - Dramatiq workers configured
   - Redis queue setup
   - Retry logic + error handling
   - Cron scheduling support
   - Use for: LLM processing, webhook delivery, analytics
   - **Value:** $10K-$15K saved

5. **API Infrastructure (⭐⭐⭐⭐⭐)**
   - OAuth2 + personal access tokens
   - Scope-based permissions (97 scopes)
   - Pagination, sorting, filtering
   - OpenAPI auto-documentation
   - Rate limiting
   - **Value:** $15K-$20K saved

6. **Production-Ready Patterns (⭐⭐⭐⭐⭐)**
   - Service/repository separation
   - Async/await throughout
   - Type safety (Pydantic + SQLAlchemy 2.0)
   - Database migrations (Alembic)
   - Error handling + logging
   - **Value:** Priceless (proven architecture)

7. **Customer Management (⭐⭐⭐⭐☆)**
   - Customer entity with billing details
   - OAuth integration (GitHub, Discord)
   - Payment method storage
   - Metadata support
   - Wallet/balance system
   - **Extend:** Add phone, WhatsApp ID

8. **Fast Time-to-Market (⭐⭐⭐⭐⭐)**
   - 8-10 weeks to MVP vs 16-20 weeks
   - Focus on differentiation (Agent Core)
   - Skip solved problems (payments, accounting)

**CONS:**

1. **Inherited Complexity (⚠️ HIGH)**
   - 67 SQLAlchemy models (some 10K+ lines)
   - 235 database migrations to understand
   - 58 business modules (only need ~30)
   - Complex relationships (circular imports)
   - **Mitigation:**
     - Remove unused modules (GitHub, subscriptions, ads)
     - Document only models you touch
     - Use repository pattern (don't touch models directly)

2. **Stripe Lock-In (⚠️ HIGH)**
   - Tightly coupled to Stripe (no abstraction layer)
   - Hard to add PIX, Wise, PayTo without refactoring
   - Payment processor in every service method
   - **Mitigation:**
     - Build adapter pattern for new payment rails
     - Create `PaymentRailAdapter` interface
     - Wrap Stripe service with adapter

3. **Large Codebase (⚠️ MEDIUM)**
   - ~150K+ lines of Python
   - Steeper learning curve for new developers
   - More code to maintain
   - **Mitigation:**
     - Focus on modules you use
     - Document AgentPay-specific changes
     - Create architectural decision records (ADRs)

4. **Unused Features (⚠️ MEDIUM)**
   - 30-40% of codebase irrelevant (GitHub, ads, subscriptions)
   - Increased cognitive load
   - Potential security surface
   - **Mitigation:**
     - Delete unused modules
     - Disable unused endpoints
     - Document what's removed

5. **Database Schema Complexity (⚠️ MEDIUM)**
   - 67 tables with complex relationships
   - JSONB columns hide schema complexity
   - Migration history hard to follow
   - **Mitigation:**
     - Create ER diagram for AgentPay-relevant tables
     - Add new tables cleanly (don't modify existing)
     - Use soft deletes (don't drop Polar tables)

6. **Must Track Polar Updates (⚠️ LOW-MEDIUM)**
   - Polar evolves independently
   - Security patches may be relevant
   - Can't easily pull updates after fork
   - **Mitigation:**
     - Fork at stable release
     - Monitor Polar repo for security issues
     - Cherry-pick critical patches

7. **Python Performance (⚠️ LOW)**
   - Slower than Go/Rust for high-throughput
   - LLM latency dominates anyway (2-5s response times)
   - **Mitigation:**
     - Async/await handles concurrency well
     - Use Redis for caching
     - Offload LLM calls to background jobs

**TECHNICAL COMPLEXITY: Medium**

**Integration Effort:**
- Week 1-2: Remove unused modules, understand payment flow
- Week 3-4: Add Agent Core models + services
- Week 5-6: Build RAG system + LLM integration
- Week 7-8: Conversational checkout flow
- Week 9-10: Chat widget + merchant dashboard

**DATA MODEL ADJUSTMENTS:**

**New Tables:**
```sql
-- Agent system
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,  -- Multi-tenant
    name VARCHAR(255),
    personality JSONB,  -- Tone, style, rules
    tools JSONB,  -- Available functions
    created_at TIMESTAMPTZ,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL,
    customer_id UUID,  -- Link to existing Customer
    channel VARCHAR(50),  -- 'web', 'whatsapp', 'telegram'
    status VARCHAR(50),  -- 'active', 'closed', 'escalated'
    metadata JSONB,  -- Session context
    created_at TIMESTAMPTZ,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    role VARCHAR(20),  -- 'user', 'agent', 'system'
    content TEXT,
    metadata JSONB,  -- Intent, entities, tool calls
    created_at TIMESTAMPTZ,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Extend Checkout for conversations
CREATE TABLE conversation_checkouts (
    -- Inherits from checkouts
    conversation_id UUID,
    commitment_level VARCHAR(50),  -- 'browsing', 'interested', 'ready'
    negotiation_state JSONB,  -- Offers, counteroffers
    agent_context JSONB,  -- Customer signals
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
) INHERITS (checkouts);

-- Dynamic pricing
CREATE TABLE agent_price_offers (
    id UUID PRIMARY KEY,
    checkout_id UUID NOT NULL,
    base_price INTEGER,
    adjustments JSONB,  -- [{"type": "volume", "delta": -500}]
    final_price INTEGER,
    reasoning TEXT,
    valid_until TIMESTAMPTZ,
    accepted BOOLEAN,
    FOREIGN KEY (checkout_id) REFERENCES checkouts(id)
);
```

**Modified Tables:**
```sql
-- Extend Customer
ALTER TABLE customers ADD COLUMN phone_number VARCHAR(50);
ALTER TABLE customers ADD COLUMN whatsapp_id VARCHAR(100);
ALTER TABLE customers ADD COLUMN telegram_id VARCHAR(100);
ALTER TABLE customers ADD COLUMN preferred_channel VARCHAR(20);

-- Extend Product
ALTER TABLE products ADD COLUMN conversational_description TEXT;
ALTER TABLE products ADD COLUMN voice_description VARCHAR(500);
ALTER TABLE products ADD COLUMN sales_objections JSONB;
ALTER TABLE products ADD COLUMN upsell_triggers JSONB;
ALTER TABLE products ADD COLUMN allow_dynamic_pricing BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN pricing_bounds JSONB;

-- Extend Order
ALTER TABLE orders ADD COLUMN conversation_id UUID;
ALTER TABLE orders ADD COLUMN negotiation_summary TEXT;
```

**MULTI-TENANCY: Excellent**
- Organization-scoped agents
- Isolated conversation data
- Per-merchant agent configurations
- Shared payment infrastructure
- **No changes needed** - Polar's multi-tenancy perfect for AgentPay SaaS

**MULTI-CURRENCY: Built-in**
- Polar supports 90+ currencies
- Currency conversion handled
- Stripe multi-currency accounts
- Tax calculations per country
- **Ready to use**

**RAG KNOWLEDGE BASE INTEGRATION:**

```python
# New module: /server/polar/agent_knowledge/

class AgentKnowledgeService:
    """Manages RAG knowledge base for agents"""

    async def index_product_catalog(
        self,
        organization_id: UUID
    ) -> None:
        """Index all products for semantic search"""
        products = await product_repo.list_by_organization(organization_id)

        embeddings = await self.embedding_service.embed_products(products)
        await self.vector_store.upsert(embeddings)

    async def search(
        self,
        query: str,
        organization_id: UUID,
        limit: int = 5
    ) -> list[Product]:
        """Semantic search over product catalog"""
        query_embedding = await self.embedding_service.embed(query)
        results = await self.vector_store.search(
            query_embedding,
            filters={"organization_id": organization_id},
            limit=limit
        )
        return results
```

**Integration Points:**
- Use existing Product/ProductPrice models
- Add conversational metadata
- Index product descriptions for RAG
- Store embeddings in PostgreSQL (pgvector) or Pinecone
- Update embeddings when products change (Dramatiq job)

**AGENT API COMPATIBILITY:**

```python
# New endpoints: /server/polar/agent/endpoints.py

@router.post("/conversations")
async def create_conversation(
    organization_id: OrganizationID,
    customer_id: CustomerID | None,
    auth_subject: auth.AgentWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ConversationSchema:
    """Create new agent conversation"""
    conversation = await agent_service.create_conversation(
        session, organization_id, customer_id
    )
    return conversation

@router.post("/conversations/{id}/messages")
async def send_message(
    id: UUID,
    message: MessageCreate,
    auth_subject: auth.AgentWrite,
    session: AsyncSession = Depends(get_db_session),
) -> MessageSchema:
    """Send message and get agent response"""
    # Process with Agent Core
    response = await agent_core.process_message(
        conversation_id=id,
        user_message=message.content,
        session=session
    )
    return response
```

**Compatible with:**
- OpenAI Assistants API format
- Anthropic Messages API
- Custom AgentPay SDK

**TIMELINE: 8-10 Weeks**

**Week 1-2:** Setup + Cleanup
- Fork Polar repository
- Remove GitHub, subscription, ads modules
- Database cleanup migration
- Local development environment

**Week 3-4:** Agent Core Foundation
- Agent/Conversation/Message models
- Agent Core service (intent, context, tools)
- LLM integration (Anthropic/OpenAI)
- Basic chat API endpoints

**Week 5-6:** RAG + Knowledge
- Product indexing (embeddings)
- Vector store integration
- Semantic search service
- Knowledge retrieval in conversations

**Week 7-8:** Conversational Checkout
- ConversationCheckout model
- Dynamic pricing service
- Multi-turn checkout flow
- Payment link generation

**Week 9-10:** Frontend + Polish
- Chat widget (iframe embed)
- Merchant dashboard
- Testing + bug fixes
- Documentation

**SCALABILITY:**

**Strengths:**
- Async/await handles high concurrency
- Read replicas for queries
- Background jobs for heavy lifting (LLM calls)
- Redis caching
- Connection pooling

**Bottlenecks:**
- LLM API latency (2-5s)
- Single PostgreSQL instance (all tenants)
- Python GIL for CPU-bound tasks

**Mitigation:**
- Stream LLM responses (SSE)
- Database sharding by organization (future)
- Separate LLM service (microservice pattern)
- CDN for chat widget

**Estimated Scale:**
- 1K concurrent conversations: ✅ Easy
- 10K concurrent conversations: ✅ Possible (vertical scaling)
- 100K concurrent conversations: ⚠️ Requires architecture changes

---

### Option B: Build Minimal Payments Platform from Scratch

**Technical Implementation:**

```
New Project
├── Backend: FastAPI or Express.js
├── Database: PostgreSQL (minimal schema)
├── Payment: Stripe SDK (direct integration)
├── Auth: JWT tokens
├── Jobs: BullMQ or Celery
├── Agent: LangChain or custom
└── Frontend: Astro + Svelte/React
```

**MINIMAL FEATURES TO BUILD:**

**Phase 1: Core Payment (4-6 weeks)**
1. Product catalog (basic CRUD)
2. Checkout sessions
3. Stripe payment integration
4. Order creation
5. Webhook handling
6. Customer records

**Phase 2: Agent System (4-6 weeks)**
7. Conversation state management
8. LLM integration
9. Intent recognition
10. Tool calling (product lookup, payment)
11. Response generation

**Phase 3: Knowledge (2-3 weeks)**
12. Product embeddings
13. Vector search
14. Knowledge retrieval

**Phase 4: Frontend (3-4 weeks)**
15. Chat widget (Astro-native)
16. Merchant dashboard
17. Embed script

**SIMPLEST DB SCHEMA:**

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    stripe_account_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name VARCHAR(255),
    description TEXT,
    price_cents INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    stripe_customer_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    customer_id UUID,
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    role VARCHAR(20),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    conversation_id UUID,
    status VARCHAR(50),
    amount_cents INTEGER,
    currency VARCHAR(3),
    stripe_payment_intent_id VARCHAR(255),
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Embeddings (for RAG)
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL,
    embedding VECTOR(1536),  -- OpenAI ada-002
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX ON product_embeddings
    USING ivfflat (embedding vector_cosine_ops);
```

**Total: 7 tables** (vs Polar's 67)

**SIMPLEST API ROUTES:**

**Products:**
- `GET /products` - List products
- `POST /products` - Create product
- `GET /products/:id` - Get product

**Conversations:**
- `POST /conversations` - Start conversation
- `POST /conversations/:id/messages` - Send message
- `GET /conversations/:id` - Get conversation history

**Checkout:**
- `POST /checkout` - Create checkout session
- `POST /checkout/:id/confirm` - Confirm payment
- `POST /webhooks/stripe` - Stripe webhooks

**RECOMMENDED TECHNOLOGIES:**

**Backend:**
```
Option 1 (Python):
  FastAPI + SQLAlchemy + Pydantic
  Pros: Same as Polar, familiar
  Cons: Slower than Node.js

Option 2 (Node.js):
  Express + Prisma + Zod
  Pros: Faster, better for real-time
  Cons: Different ecosystem
```

**Recommendation:** Python (FastAPI) for consistency with Polar patterns

**LLM Integration:**
```
Option 1: LangChain
  Pros: Batteries-included
  Cons: Heavy, opinionated

Option 2: Direct API calls
  Pros: Simple, lightweight
  Cons: More code to write

Option 3: Vercel AI SDK
  Pros: Great DX, streaming
  Cons: Node.js only
```

**Recommendation:** Direct API calls (Anthropic/OpenAI SDKs)

**Vector Store:**
```
Option 1: pgvector (PostgreSQL extension)
  Pros: Same database, simple
  Cons: Limited scale

Option 2: Pinecone
  Pros: Managed, scalable
  Cons: External dependency, cost

Option 3: Weaviate
  Pros: Open-source, powerful
  Cons: Another service to run
```

**Recommendation:** pgvector for MVP, Pinecone for scale

**FASTER PATH TO MVP:**

**Pros:**
- ✅ Lean codebase (only what you need)
- ✅ Full control over architecture
- ✅ No legacy complexity
- ✅ Easy to understand for new developers
- ✅ Can use modern tools (Prisma, tRPC, etc.)
- ✅ No unused features

**Cons:**
- ❌ 16-20 weeks vs 8-10 weeks
- ❌ Must build payment infrastructure
- ❌ No transaction accounting (complex to build)
- ❌ No tax compliance (research required)
- ❌ No multi-currency (must implement)
- ❌ No battle-tested patterns
- ❌ Higher risk of bugs

**MAINTENANCE PROFILE:**

**Pros:**
- ✅ Smaller codebase (faster to modify)
- ✅ No upstream dependencies (Polar changes)
- ✅ Only maintain what you use

**Cons:**
- ❌ Must maintain payment integrations yourself
- ❌ Security patches are your responsibility
- ❌ No community support

**TECHNICAL DEBT:**

**Polar Approach:**
- Inherit some technical debt
- But also inherit solutions to hard problems

**From Scratch:**
- No initial technical debt
- But will accumulate your own
- Payment infrastructure is complex (easy to get wrong)

---

### Strong Recommendation: **Build on Polar Foundation** ⭐⭐⭐⭐⭐

**Reasoning:**

1. **Time is Money**
   - 8-10 weeks vs 16-20 weeks = 2-3 months saved
   - At $15K/week (2 senior engineers), that's $120K-$180K saved
   - Faster time-to-market = faster revenue

2. **De-Risk Payment Infrastructure**
   - Payments are complex (fraud, chargebacks, webhooks, retries)
   - Polar's payment system is battle-tested
   - Don't reinvent the wheel on solved problems

3. **Focus on Differentiation**
   - Agent Core is your competitive advantage
   - Payment processing is table stakes
   - Spend time on what makes AgentPay unique

4. **Financial Compliance**
   - Tax calculation is hard (varies by jurisdiction)
   - Stripe Tax API is $$$
   - Polar has this integrated

5. **Multi-Tenancy from Day 1**
   - Building SaaS? You need multi-tenancy
   - Polar's organization model is perfect
   - Hard to retrofit later

6. **Production-Ready Patterns**
   - Background jobs
   - Webhook retries
   - Error handling
   - Async/await
   - Type safety
   - These take months to get right

**When to Build from Scratch:**
- You need <7-day MVP (use Stripe Checkout + simple backend)
- You have strong opinions on architecture (and team to execute)
- Polar's patterns conflict with your vision
- You're building single-tenant (not SaaS)

**But for AgentPay:**
- Multi-tenant SaaS
- Need robust payments
- Want to focus on AI/agent layer
- **Polar is the right choice**

---

## 3. Agent Core Architecture

### Full System Architecture Diagram (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           MERCHANT'S ASTRO WEBSITE                             │
│                                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Product Page │  │  Homepage    │  │  Cart        │  │  Checkout    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
│         └─────────────────┴─────────────────┴─────────────────┘              │
│                                   │                                          │
│                        <script src="agentpay-widget.js">                     │
│                        <div data-agentpay-chat />                            │
└────────────────────────────────────┬───────────────────────────────────────────┘
                                     │
                                     │ PostMessage API
                                     ▼
                         ┌───────────────────────┐
                         │   Chat Widget (iframe) │
                         │   ┌───────────────┐   │
                         │   │ React UI      │   │
                         │   │ - Input       │   │
                         │   │ - Messages    │   │
                         │   │ - Product     │   │
                         │   │   Cards       │   │
                         │   │ - Payment     │   │
                         │   │   Button      │   │
                         │   └───────┬───────┘   │
                         └───────────┼───────────┘
                                     │
                            WebSocket/SSE Connection
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              AGENTPAY BACKEND                                  │
│                          (Polar Foundation + Extensions)                       │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                         API LAYER (FastAPI)                               │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐        │ │
│  │  │ /conv      │  │ /messages  │  │ /checkout  │  │ /products   │        │ │
│  │  │  /create   │  │  /send     │  │  /create   │  │  /search    │        │ │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘        │ │
│  └────────┼──────────────── ┼───────────────┼─────────────────┼─────────────┘ │
│           │                 │                │                 │               │
│           │        Auth Middleware (Organization Scope)        │               │
│           │                 │                │                 │               │
│  ┌────────▼─────────────────▼────────────────▼─────────────────▼─────────────┐ │
│  │                        AGENT CORE SERVICE                                  │ │
│  │  ╔══════════════════════════════════════════════════════════════════════╗ │ │
│  │  ║  async def process_message(conversation_id, user_message, context)  ║ │ │
│  │  ╚═════════════════════════════════┬════════════════════════════════════╝ │ │
│  │                                    │                                       │ │
│  │                                    ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 1: Conversation Understanding              │  │ │
│  │  │  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐  │  │ │
│  │  │  │ Rule-Based  │────▶│ Intent       │────▶│ Hybrid Intent       │  │  │ │
│  │  │  │ Classifier  │     │ Classifier   │     │ Confidence Score    │  │  │ │
│  │  │  │ (Regex/     │     │ (LLM)        │     │ • product_query     │  │  │ │
│  │  │  │  Keywords)  │     │              │     │ • purchase_intent   │  │  │ │
│  │  │  │             │     │              │     │ • price_negotiation │  │  │ │
│  │  │  └─────────────┘     └──────────────┘     │ • checkout_ready    │  │  │ │
│  │  │                                            └─────────┬───────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────┼──────────────┘  │ │
│  │                                                          │                 │ │
│  │                                    ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 2: Context Enrichment                      │  │ │
│  │  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │  │ │
│  │  │  │ Product      │   │ User Context │   │ Page Context         │   │  │ │
│  │  │  │ Context      │   │ - History    │   │ - Current URL        │   │  │ │
│  │  │  │ (from RAG)   │   │ - Cart       │   │ - Referrer           │   │  │ │
│  │  │  │              │   │ - Purchases  │   │ - Time on page       │   │  │ │
│  │  │  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘   │  │ │
│  │  │         │                   │                      │               │  │ │
│  │  │         └───────────────────┴──────────────────────┘               │  │ │
│  │  │                             │                                       │  │ │
│  │  │                   ┌─────────▼──────────┐                           │  │ │
│  │  │                   │  EnrichedContext   │                           │  │ │
│  │  │                   │  {product, user,   │                           │  │ │
│  │  │                   │   conversation}    │                           │  │ │
│  │  │                   └─────────┬──────────┘                           │  │ │
│  │  └─────────────────────────────┼────────────────────────────────────┘  │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 3: Decision Engine                         │  │ │
│  │  │  ┌──────────────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Rule-Based Action Selector (DETERMINISTIC)                   │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ if intent == PRODUCT_QUERY:                                  │  │  │ │
│  │  │  │     return Action.SEARCH_PRODUCTS                            │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ if intent == PURCHASE_INTENT:                                │  │  │ │
│  │  │  │     if not context.selected_variant:                         │  │  │ │
│  │  │  │         return Action.ASK_VARIANT                            │  │  │ │
│  │  │  │     return Action.GENERATE_CHECKOUT                          │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ if intent == PRICE_NEGOTIATION:                              │  │  │ │
│  │  │  │     if allowed_dynamic_pricing:                              │  │  │ │
│  │  │  │         return Action.CALCULATE_OFFER                        │  │  │ │
│  │  │  │     return Action.EXPLAIN_NO_DISCOUNT                        │  │  │ │
│  │  │  └──────────────────────────┬───────────────────────────────────┘  │  │ │
│  │  │                             │                                       │  │ │
│  │  │                   ┌─────────▼──────────┐                           │  │ │
│  │  │                   │   Selected Action  │                           │  │ │
│  │  │                   │   + Parameters     │                           │  │ │
│  │  │                   └─────────┬──────────┘                           │  │ │
│  │  └─────────────────────────────┼────────────────────────────────────┘  │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 4: Tool Invocation                         │  │ │
│  │  │  ┌────────────────────────────────────────────────────────────┐    │  │ │
│  │  │  │              Tool Registry                                 │    │  │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │    │  │ │
│  │  │  │  │ Product      │  │ Payment Link │  │ Variant       │   │    │  │ │
│  │  │  │  │ Lookup Tool  │  │ Generator    │  │ Selector      │   │    │  │ │
│  │  │  │  │              │  │              │  │               │   │    │  │ │
│  │  │  │  │ • RAG Search │  │ • Stripe     │  │ • Filter by   │   │    │  │ │
│  │  │  │  │ • Filters    │  │   Intent     │  │   size/color  │   │    │  │ │
│  │  │  │  └──────────────┘  └──────────────┘  └───────────────┘   │    │  │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │    │  │ │
│  │  │  │  │ Shipping     │  │ Discount     │  │ Inventory     │   │    │  │ │
│  │  │  │  │ Calculator   │  │ Validator    │  │ Checker       │   │    │  │ │
│  │  │  │  └──────────────┘  └──────────────┘  └───────────────┘   │    │  │ │
│  │  │  └────────────────────────────┬───────────────────────────────┘    │  │ │
│  │  │                               │                                     │  │ │
│  │  │                     ┌─────────▼──────────┐                         │  │ │
│  │  │                     │   Tool Results     │                         │  │ │
│  │  │                     │   (products,       │                         │  │ │
│  │  │                     │    payment_link,   │                         │  │ │
│  │  │                     │    shipping_cost)  │                         │  │ │
│  │  │                     └─────────┬──────────┘                         │  │ │
│  │  └───────────────────────────────┼──────────────────────────────────┘  │ │
│  │                                  │                                     │ │
│  │                                  ▼                                     │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 5: Response Generation                     │  │ │
│  │  │  ┌──────────────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Template-Based Generator (with LLM enhancement)              │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ TEMPLATES = {                                                │  │  │ │
│  │  │  │   Action.GENERATE_CHECKOUT: """                              │  │  │ │
│  │  │  │   Perfect! Here's your secure checkout:                      │  │  │ │
│  │  │  │   💰 {product_name} - {formatted_price}                      │  │  │ │
│  │  │  │   [Checkout Button]                                          │  │  │ │
│  │  │  │   🔒 Secure • Free shipping over $50                         │  │  │ │
│  │  │  │   """,                                                        │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │   Action.PRODUCT_RECOMMENDATION: LLM                         │  │  │ │
│  │  │  │ }                                                             │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ Trust Signals:                                               │  │  │ │
│  │  │  │ • "Secure checkout"                                          │  │  │ │
│  │  │  │ • "X customers bought today"                                 │  │  │ │
│  │  │  │ • "30-day return policy"                                     │  │  │ │
│  │  │  └──────────────────────────┬───────────────────────────────────┘  │  │ │
│  │  │                             │                                       │  │ │
│  │  │                   ┌─────────▼──────────┐                           │  │ │
│  │  │                   │  Agent Response    │                           │  │ │
│  │  │                   │  {text, buttons,   │                           │  │ │
│  │  │                   │   product_cards}   │                           │  │ │
│  │  │                   └─────────┬──────────┘                           │  │ │
│  │  └─────────────────────────────┼────────────────────────────────────┘  │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    LAYER 6: State Memory                            │  │ │
│  │  │  ┌──────────────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Redis-Backed Session Management                              │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ ConversationState:                                           │  │  │ │
│  │  │  │   session_id: str                                            │  │  │ │
│  │  │  │   product_id: str | None                                     │  │  │ │
│  │  │  │   selected_variant: dict | None                              │  │  │ │
│  │  │  │   payment_link_generated: bool                               │  │  │ │
│  │  │  │   payment_status: str                                        │  │  │ │
│  │  │  │   messages: list[Message]                                    │  │  │ │
│  │  │  │   hesitation_signals: int                                    │  │  │ │
│  │  │  │   last_intent: Intent                                        │  │  │ │
│  │  │  │   context_enrichment: dict                                   │  │  │ │
│  │  │  │                                                               │  │  │ │
│  │  │  │ Persistence:                                                 │  │  │ │
│  │  │  │   • Redis (hot cache, 7-day TTL)                             │  │  │ │
│  │  │  │   • PostgreSQL (long-term, analytics)                        │  │  │ │
│  │  │  └──────────────────────────────────────────────────────────────┘  │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                        SUPPORTING SERVICES                                │ │
│  │                                                                           │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐    │ │
│  │  │  RAG Knowledge  │  │  Payment        │  │  Background Jobs     │    │ │
│  │  │  Service        │  │  Orchestrator   │  │  (Dramatiq)          │    │ │
│  │  │                 │  │  (Polar Base)   │  │                      │    │ │
│  │  │  • Embeddings   │  │  • Stripe       │  │  • LLM Processing    │    │ │
│  │  │  • Vector Search│  │  • PIX          │  │  • Embedding Index   │    │ │
│  │  │  • Indexing     │  │  • Wise         │  │  • Webhook Delivery  │    │ │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘    │ │
│  │           │                    │                       │                │ │
│  └───────────┼────────────────────┼───────────────────────┼────────────────┘ │
│              │                    │                       │                  │
│  ┌───────────▼────────────────────▼───────────────────────▼────────────────┐ │
│  │                          DATA LAYER                                      │ │
│  │                                                                           │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │ PostgreSQL  │  │ Redis Cache  │  │ S3/MinIO     │  │ Vector DB   │  │ │
│  │  │             │  │              │  │              │  │ (pgvector   │  │ │
│  │  │ • Users     │  │ • Sessions   │  │ • Invoices   │  │  or         │  │ │
│  │  │ • Products  │  │ • Rate Limit │  │ • Images     │  │  Pinecone)  │  │ │
│  │  │ • Orders    │  │ • Job Queue  │  │              │  │             │  │ │
│  │  │ • Messages  │  │              │  │              │  │ • Embeddings│  │ │
│  │  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

                                EXTERNAL INTEGRATIONS
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
        ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
        │  LLM Providers  │    │  Payment Rails  │    │  Messaging      │
        │                 │    │                 │    │                 │
        │  • Anthropic    │    │  • Stripe       │    │  • WhatsApp API │
        │  • OpenAI       │    │  • PIX (BR)     │    │  • Telegram     │
        │  • (Fallback)   │    │  • Wise         │    │  • SMS          │
        └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flows

**Flow 1: Customer Sends Message →  Response**

```
1. Customer types "I'm looking for a blue dress under $100"
   └─▶ WebSocket → API Layer

2. API Layer
   └─▶ Authenticate session
   └─▶ Route to Agent Core Service

3. Agent Core → Layer 1: Conversation Understanding
   └─▶ Rule-based: Detects "looking for" → product_query
   └─▶ LLM: Extracts entities {category: "dress", color: "blue", max_price: 100}
   └─▶ Result: Intent(PRODUCT_QUERY, entities={...}, confidence=0.95)

4. Agent Core → Layer 2: Context Enrichment
   └─▶ Load customer history (previous purchases)
   └─▶ Get current page context (on /products page)
   └─▶ Retrieve conversation state from Redis
   └─▶ Result: EnrichedContext{user: {size: "M"}, conversation: {...}}

5. Agent Core → Layer 3: Decision Engine
   └─▶ Match intent=PRODUCT_QUERY
   └─▶ Select Action: SEARCH_PRODUCTS
   └─▶ Parameters: {query: "blue dress", filters: {price_max: 10000}}

6. Agent Core → Layer 4: Tool Invocation
   └─▶ Invoke ProductLookupTool
       └─▶ Query RAG system with "blue dress"
       └─▶ Get top 5 products with embeddings similarity
       └─▶ Apply filters (color=blue, price≤$100)
       └─▶ Return: [Product1, Product2, Product3]

7. Agent Core → Layer 5: Response Generation
   └─▶ Use template: PRODUCT_RESULTS
   └─▶ Insert product cards
   └─▶ Add trust signals ("30-day returns", "Free shipping")
   └─▶ Result: {text: "I found 3 perfect options for you!", product_cards: [...]}

8. Agent Core → Layer 6: State Memory
   └─▶ Save message to conversation history
   └─▶ Update state: last_intent=PRODUCT_QUERY, last_products=[...]
   └─▶ Persist to Redis + PostgreSQL

9. Return Response
   └─▶ WebSocket → Chat Widget
   └─▶ Render: Message + Product Cards
```

**Flow 2: Customer Clicks "Buy Now" → Payment**

```
1. Customer clicks "Buy Now" on Product2
   └─▶ PostMessage: {action: "buy", product_id: "prod_123", variant: "M"}

2. API Layer: POST /checkout/create
   └─▶ Auth: Validate session
   └─▶ Create ConversationCheckout
       └─▶ Link to conversation_id
       └─▶ commitment_level = "ready_to_pay"

3. Agent Core → Layer 3: Decision Engine
   └─▶ Action: GENERATE_CHECKOUT

4. Agent Core → Layer 4: Tool Invocation
   └─▶ PaymentLinkTool
       └─▶ Call Polar Checkout Service
       └─▶ Create Stripe Payment Intent
       └─▶ Generate checkout URL: https://agentpay.com/checkout/polar_c_abc123

5. Agent Core → Layer 5: Response
   └─▶ Template: CHECKOUT_READY
   └─▶ "Here's your secure checkout link. Tap to complete purchase."
   └─▶ [Checkout Button]

6. Customer completes payment (Stripe)
   └─▶ Stripe webhook → AgentPay
   └─▶ Checkout confirmed
   └─▶ Order created (Polar Order Service)
   └─▶ Conversation updated: payment_status = "succeeded"

7. Background Job (Dramatiq)
   └─▶ Send confirmation email
   └─▶ Notify merchant
   └─▶ Update inventory
   └─▶ Post to conversation: "✅ Payment confirmed! Your order #123 is being prepared."
```

**Flow 3: Price Negotiation**

```
1. Customer: "Can you do $80 instead of $95?"
   └─▶ Intent: PRICE_NEGOTIATION
   └─▶ Entity: {proposed_price: 8000}

2. Layer 3: Decision Engine
   └─▶ Check: product.allow_dynamic_pricing
   └─▶ Check: pricing_bounds {min: 7500, max: 10000}
   └─▶ Proposed $80 is ≥ min ($75)
   └─▶ Action: CALCULATE_OFFER

3. Layer 4: Tool Invocation
   └─▶ DynamicPricingTool
       └─▶ Calculate adjustments:
           - Volume: 0 (single item)
           - First-time customer: -$5 (500 cents)
           - Urgency: 0
       └─▶ Final offer: $85 (8500 cents)
       └─▶ Create AgentPriceOffer record

4. Layer 5: Response
   └─▶ "I can offer you $85 for your first purchase! That's a great deal on this item."
   └─▶ [Accept $85] [Counter-offer]

5. If customer accepts:
   └─▶ Update checkout with offer_id
   └─▶ Generate payment link with adjusted price
```

### Modules Required

**New Modules (Build):**
```
/server/polar/agent/               # Agent Core
├── service.py                     # Main orchestration
├── endpoints.py                   # API routes
├── models.py                      # Agent, Conversation
├── repository.py                  # Data access
└── schemas.py                     # Pydantic models

/server/polar/agent_conversation/  # Conversation management
├── service.py                     # CRUD operations
├── state_manager.py               # Redis state
└── message_handler.py             # Message processing

/server/polar/agent_knowledge/     # RAG system
├── service.py                     # Knowledge base ops
├── embedding_service.py           # Generate embeddings
├── vector_store.py                # pgvector/Pinecone
└── indexing_tasks.py              # Background indexing

/server/polar/agent_tools/         # Tool registry
├── product_lookup.py              # RAG search
├── payment_link.py                # Checkout generation
├── shipping_calculator.py         # Shipping quotes
├── discount_validator.py          # Coupon checking
└── inventory_checker.py           # Stock validation

/server/polar/multi_agent/         # Multi-agent orchestration
├── orchestrator.py                # Route to sub-agents
├── sales_agent.py                 # Sales specialist
├── support_agent.py               # Support specialist
└── payment_agent.py               # Payment specialist
```

**Extend Existing Modules:**
```
/server/polar/checkout/
└── Add: ConversationCheckout model
└── Add: Dynamic pricing methods

/server/polar/product/
└── Add: Conversational metadata fields
└── Add: Embedding generation trigger

/server/polar/customer/
└── Add: Phone, WhatsApp ID fields
└── Add: Conversation relationship
```

### How Components Communicate

**1. Synchronous (HTTP/WebSocket):**
- Chat Widget ↔ API Layer: WebSocket (bi-directional)
- API Layer → Agent Core: Direct service calls
- Agent Core → Tools: Sync function calls
- Agent Core → RAG: Async calls (but awaited)

**2. Asynchronous (Background Jobs):**
- Embedding Indexing: Triggered on product create/update
- Webhook Delivery: Dramatiq jobs with retry
- Email Notifications: Queued jobs
- Analytics Processing: Batch jobs

**3. Event-Driven (Polar Events):**
- Order Created → Trigger: Send confirmation, update inventory
- Payment Failed → Trigger: Retry notification, update conversation
- Checkout Expired → Trigger: Send abandonment message

**4. State Management:**
- **Hot State** (Redis): Current conversation, last 100 messages
- **Cold State** (PostgreSQL): Full conversation history
- **Cache** (Redis): Product catalog, pricing rules

### RAG Indexing Process

```
┌──────────────────────────────────────────┐
│    Product Catalog in PostgreSQL         │
│  ┌────────────────────────────────────┐  │
│  │ id, name, description, price, ...  │  │
│  └─────────────────┬──────────────────┘  │
└────────────────────┼─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  Embedding Service (Background Job)      │
│  ┌────────────────────────────────────┐  │
│  │ For each product:                  │  │
│  │   text = f"{name} {description}    │  │
│  │            {category} {attributes}"│  │
│  │   embedding = openai.embed(text)   │  │
│  └─────────────────┬──────────────────┘  │
└────────────────────┼─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│     Vector Store (pgvector/Pinecone)     │
│  ┌────────────────────────────────────┐  │
│  │ Insert (product_id, embedding)     │  │
│  │ With metadata: {price, category}   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

Search Flow:
1. User query: "blue summer dress"
2. Embed query → vector
3. Vector search (cosine similarity)
4. Get top K products
5. Rerank by price, availability
6. Return to Agent Core
```

### LLM Connection Points

**Anthropic Claude (Primary):**
```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

async def classify_intent(message: str, conversation_history: list) -> Intent:
    """Hybrid: Use Claude for complex intents"""
    response = await client.messages.create(
        model="claude-3-5-sonnet-20250219",
        max_tokens=100,
        messages=[
            {
                "role": "user",
                "content": f"""Classify customer intent:

                Message: {message}

                Intent options:
                - product_query
                - purchase_intent
                - price_negotiation
                - shipping_question
                - support_request

                Return JSON: {{"intent": "...", "entities": {{...}}, "confidence": 0.9}}
                """
            }
        ]
    )
    return parse_intent(response.content[0].text)
```

**OpenAI (Embeddings):**
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def embed_product(product: Product) -> list[float]:
    """Generate product embeddings for RAG"""
    text = f"{product.name} {product.description} {product.category}"
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding
```

### When to Store vs Retrieve Memory

**Always Store (Immediate):**
- Every message (user + agent)
- Intent classification results
- Tool invocations (for debugging)
- State transitions (browsing → interested → ready)

**Store to Redis (Hot Cache):**
- Current conversation state
- Last 100 messages (for context window)
- Customer profile (for quick lookup)
- TTL: 7 days

**Store to PostgreSQL (Long-term):**
- Full conversation history
- Negotiation records
- Payment attempts
- Analytics data

**Retrieve for Context:**
- Last 10 messages (for LLM context)
- Customer purchase history (for personalization)
- Product browsing history (for recommendations)
- Failed payment attempts (for risk assessment)

**Don't Store:**
- Payment card details (Stripe handles)
- PII beyond what's needed (GDPR)
- LLM raw responses (just final output)

### Real-Time Negotiation Logic

```python
class DynamicPricingEngine:
    """Calculate dynamic offers based on rules"""

    def calculate_offer(
        self,
        product: Product,
        customer: Customer,
        conversation: Conversation,
        proposed_price: int | None = None
    ) -> AgentPriceOffer:
        base_price = product.price_amount
        adjustments = []

        # Rule 1: First-time customer (5% off)
        if customer.order_count == 0:
            adjustments.append({
                "type": "first_time",
                "delta": -int(base_price * 0.05),
                "reason": "First purchase discount"
            })

        # Rule 2: Volume (10% off for 3+ items)
        cart_items = conversation.metadata.get("cart_items", [])
        if len(cart_items) >= 3:
            adjustments.append({
                "type": "volume",
                "delta": -int(base_price * 0.10),
                "reason": "Bulk discount"
            })

        # Rule 3: Hesitation detected (5% off after 3+ "maybe" signals)
        if conversation.hesitation_signals >= 3:
            adjustments.append({
                "type": "hesitation",
                "delta": -int(base_price * 0.05),
                "reason": "Special offer for you"
            })

        # Rule 4: Respect pricing bounds
        total_delta = sum(a["delta"] for a in adjustments)
        final_price = max(
            product.pricing_bounds["min"],
            min(product.pricing_bounds["max"], base_price + total_delta)
        )

        # If customer proposed price, meet halfway
        if proposed_price:
            halfway = (final_price + proposed_price) // 2
            final_price = max(product.pricing_bounds["min"], halfway)
            adjustments.append({
                "type": "negotiation",
                "delta": halfway - final_price,
                "reason": "Meeting you halfway"
            })

        # Check if requires merchant approval (>15% off)
        discount_pct = ((base_price - final_price) / base_price) * 100
        requires_approval = discount_pct > 15

        return AgentPriceOffer(
            base_price=base_price,
            adjustments=adjustments,
            final_price=final_price,
            reasoning=self._generate_reasoning(adjustments),
            valid_until=datetime.now() + timedelta(hours=24),
            requires_merchant_approval=requires_approval
        )

    def _generate_reasoning(self, adjustments: list[dict]) -> str:
        """Human-readable explanation"""
        reasons = [a["reason"] for a in adjustments]
        return " + ".join(reasons) if reasons else "Regular price"
```

### Event-Based Orchestration

**Webhooks (Outbound to Merchants):**
```python
# When conversation leads to order
event = Event(
    type="conversation.order_created",
    payload={
        "conversation_id": conversation.id,
        "order_id": order.id,
        "customer_id": customer.id,
        "total_amount": order.total_amount,
        "negotiation_summary": conversation.negotiation_summary
    }
)
await webhook_service.deliver(organization, event)
```

**Callbacks (Internal State Transitions):**
```python
# When payment confirmed
@event_handler("checkout.succeeded")
async def on_payment_success(checkout_id: UUID):
    conversation = await get_conversation_by_checkout(checkout_id)
    await conversation_service.post_agent_message(
        conversation.id,
        "✅ Payment confirmed! Your order is being prepared."
    )
    await conversation_service.update_state(
        conversation.id,
        status="order_placed",
        payment_status="succeeded"
    )
```

**Real-Time Notifications:**
```python
# Server-Sent Events for live updates
@router.get("/conversations/{id}/stream")
async def stream_conversation(id: UUID):
    async def event_generator():
        async for event in conversation_service.subscribe(id):
            yield {
                "event": event.type,
                "data": json.dumps(event.payload)
            }

    return EventSourceResponse(event_generator())
```

---
## 4. Embedded Chat Implementation Plan (Astro MVP)

### Frontend Architecture

**Recommended Approach: Iframe Embed** (90% reuse of Polar's pattern)

```
┌─────────────────────────────────────────────────────────┐
│            Merchant's Astro E-Commerce Site              │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  ---                                           │     │
│  │  // src/pages/product/[slug].astro             │     │
│  │  ---                                           │     │
│  │  <html>                                        │     │
│  │    <body>                                      │     │
│  │      <ProductPage />                           │     │
│  │                                                 │     │
│  │      <!-- AgentPay Chat Widget -->             │     │
│  │      <div data-agentpay-chat                   │     │
│  │           data-merchant-id="org_123"           │     │
│  │           data-theme="dark"                    │     │
│  │           data-position="bottom-right">        │     │
│  │      </div>                                     │     │
│  │      <script                                   │     │
│  │        src="https://cdn.agentpay.com/widget.js"│     │
│  │        defer                                   │     │
│  │        data-auto-init>                         │     │
│  │      </script>                                 │     │
│  │    </body>                                     │     │
│  │  </html>                                       │     │
│  └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Widget Implementation

**1. Embed Script (Vanilla JS)**

Based on Polar's `/clients/packages/checkout/src/embed.ts` - adapt for chat:

```javascript
// widget.js (framework-agnostic)
class AgentPayWidget {
  constructor(config) {
    this.config = {
      merchantId: config.merchantId,
      theme: config.theme || 'light',
      position: config.position || 'bottom-right',
      apiUrl: config.apiUrl || 'https://api.agentpay.com',
      ...config
    };
    this.iframe = null;
    this.isOpen = false;
  }

  init() {
    this.createButton();
    this.setupMessageListener();
  }

  createButton() {
    const button = document.createElement('button');
    button.id = 'agentpay-chat-button';
    button.className = `agentpay-button agentpay-button--${this.config.position}`;
    button.innerHTML = `
      <svg><!-- Chat icon SVG --></svg>
      <span>Chat</span>
    `;
    button.addEventListener('click', () => this.toggle());
    document.body.appendChild(button);
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.iframe) {
      this.createIframe();
    }
    this.iframe.style.display = 'block';
    this.isOpen = true;
    this.postMessage({ type: 'focus' });
  }

  close() {
    if (this.iframe) {
      this.iframe.style.display = 'none';
    }
    this.isOpen = false;
  }

  createIframe() {
    const container = document.createElement('div');
    container.id = 'agentpay-chat-container';
    container.className = `agentpay-container agentpay-container--${this.config.position}`;
    
    const iframe = document.createElement('iframe');
    iframe.src = `${this.config.apiUrl}/widget?merchant_id=${this.config.merchantId}&theme=${this.config.theme}&origin=${encodeURIComponent(window.location.origin)}`;
    iframe.className = 'agentpay-iframe';
    iframe.allow = 'payment';
    
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    this.iframe = container;
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.config.apiUrl.replace(/:\d+$/, '')) return;
      
      const { type, payload } = event.data;
      
      switch (type) {
        case 'close':
          this.close();
          break;
        case 'order_completed':
          this.handleOrderCompleted(payload);
          break;
        case 'resize':
          this.resize(payload.height);
          break;
      }
    });
  }

  postMessage(message) {
    if (this.iframe) {
      const iframe = this.iframe.querySelector('iframe');
      iframe.contentWindow.postMessage(message, this.config.apiUrl);
    }
  }

  handleOrderCompleted(payload) {
    // Trigger merchant's conversion tracking
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'purchase', {
        transaction_id: payload.order_id,
        value: payload.amount / 100,
        currency: payload.currency
      });
    }
    
    // Fire custom event for merchant
    window.dispatchEvent(new CustomEvent('agentpay:order', { detail: payload }));
  }
}

// Auto-initialization
if (document.currentScript?.dataset.autoInit !== 'false') {
  document.addEventListener('DOMContentLoaded', () => {
    const element = document.querySelector('[data-agentpay-chat]');
    if (element) {
      new AgentPayWidget({
        merchantId: element.dataset.merchantId,
        theme: element.dataset.theme,
        position: element.dataset.position
      }).init();
    }
  });
}
```

**2. Chat Widget UI (React in iframe)**

```typescript
// /clients/packages/chat-widget/src/ChatWidget.tsx
import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { ProductCard } from './components/ProductCard';

export function ChatWidget({ merchantId, theme }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { sendMessage, connected } = useWebSocket({
    url: `wss://api.agentpay.com/v1/conversations/ws`,
    onMessage: handleMessage
  });

  function handleMessage(data: AgentMessage) {
    setIsTyping(false);
    setMessages(prev => [...prev, data]);
  }

  function handleSend(text: string) {
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);
    
    // Send to backend
    sendMessage({
      type: 'message',
      content: text,
      context: {
        page_url: window.location.href,
        referrer: document.referrer
      }
    });
  }

  return (
    <div className={`chat-widget chat-widget--${theme}`}>
      <header className="chat-header">
        <h3>Chat with us</h3>
        <button onClick={notifyClose}>✕</button>
      </header>
      
      <MessageList 
        messages={messages}
        isTyping={isTyping}
      />
      
      <MessageInput 
        onSend={handleSend}
        disabled={!connected}
      />
    </div>
  );
}
```

### Backend API for Chat Widget

**WebSocket Handler:**

```python
# /server/polar/agent/websocket.py
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/v1/conversations/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    merchant_id: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
):
    await websocket.accept()
    
    # Create or resume conversation
    conversation = await conversation_service.get_or_create(
        session,
        merchant_id=merchant_id,
        channel="web"
    )
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            # Process with Agent Core
            response = await agent_core.process_message(
                conversation_id=conversation.id,
                user_message=data["content"],
                context=data.get("context", {}),
                session=session
            )
            
            # Send response
            await websocket.send_json({
                "type": "message",
                "role": "agent",
                "content": response.text,
                "buttons": response.buttons,
                "product_cards": response.product_cards,
                "payment_link": response.payment_link
            })
            
    except WebSocketDisconnect:
        await conversation_service.update_status(
            session,
            conversation.id,
            status="paused"
        )
```

### UI Components

**Message List:**
```typescript
// Chat message bubbles
export function MessageList({ messages, isTyping }: Props) {
  return (
    <div className="message-list">
      {messages.map(msg => (
        msg.role === 'user' ? (
          <UserMessage key={msg.id} content={msg.content} />
        ) : (
          <AgentMessage 
            key={msg.id}
            content={msg.content}
            productCards={msg.product_cards}
            buttons={msg.buttons}
          />
        )
      ))}
      
      {isTyping && <TypingIndicator />}
    </div>
  );
}
```

**Product Cards:**
```typescript
// Product suggestions in chat
export function ProductCard({ product, onSelect }: Props) {
  return (
    <div className="product-card">
      <img src={product.image_url} alt={product.name} />
      <div className="product-info">
        <h4>{product.name}</h4>
        <p className="price">${(product.price / 100).toFixed(2)}</p>
        <button onClick={() => onSelect(product)}>
          View Details
        </button>
      </div>
    </div>
  );
}
```

### Best Libraries for Chat UI

**Recommended Stack:**

1. **@tanstack/react-query** - Data fetching/caching
2. **socket.io-client** OR **native WebSocket** - Real-time communication
3. **@radix-ui/react-scroll-area** - Custom scrollbars
4. **framer-motion** - Smooth animations
5. **react-markdown** - Format agent responses
6. **date-fns** - Timestamp formatting

**Lightweight Alternatives:**

- **Preact** instead of React (3KB vs 40KB)
- **zustand** instead of Redux (simple state)
- **clsx** for className management

### Keeping Widget Lightweight

**Bundle Size Optimization:**

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
    minimize: true
  },
  resolve: {
    alias: {
      'react': 'preact/compat',  // Use Preact
      'react-dom': 'preact/compat'
    }
  }
};
```

**Lazy Loading:**
```typescript
// Only load chat UI when opened
const ChatWidget = lazy(() => import('./ChatWidget'));

function App() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Chat</button>
      {isOpen && <Suspense><ChatWidget /></Suspense>}
    </>
  );
}
```

**Target Bundle Sizes:**
- Initial load (button): < 5KB gzipped
- Chat UI (lazy): < 50KB gzipped
- Total with dependencies: < 80KB gzipped

### Authentication & Context

**Session Management:**

```python
# Auto-create anonymous session
class WebSocketAuth:
    async def authenticate(
        self,
        websocket: WebSocket,
        merchant_id: str
    ) -> tuple[Organization, Customer | None]:
        # Get organization
        org = await org_repo.get_by_id(merchant_id)
        if not org:
            raise ValueError("Invalid merchant")
        
        # Check for existing session cookie
        session_token = websocket.cookies.get("agentpay_session")
        if session_token:
            customer = await customer_service.get_by_session(session_token)
            return (org, customer)
        
        # Create anonymous session
        session = await customer_service.create_anonymous_session(org.id)
        return (org, None)  # Anonymous until identified
```

**Context Passing:**

```typescript
// Merchant site passes context to widget
window.AgentPayContext = {
  product_id: 'prod_123',  // Current product
  cart_items: ['prod_456', 'prod_789'],
  customer_email: 'user@example.com',  // If logged in
  utm_source: 'google_ads'
};

// Widget reads context
function getPageContext() {
  return {
    ...window.AgentPayContext,
    page_url: window.location.href,
    page_title: document.title,
    referrer: document.referrer
  };
}
```

---

## 5. RAG Knowledge System Design

### Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE SOURCES                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Product      │  │ Policies     │  │ FAQs/Support    │ │
│  │ Catalog      │  │ - Shipping   │  │ Docs            │ │
│  │              │  │ - Returns    │  │                 │ │
│  │ - Name       │  │ - Privacy    │  │ - Common Qs     │ │
│  │ - Description│  │ - Terms      │  │ - Troubleshoot  │ │
│  │ - Attributes │  │              │  │                 │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼──────────────────┼────────────────────┼───────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌────────────────────────────────────────────────────────────┐
│              EMBEDDING & INDEXING PIPELINE                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Text Extraction & Chunking                        │  │
│  │    - Split long descriptions into chunks (512 tokens)│  │
│  │    - Preserve metadata (price, category, etc.)       │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │ 2. Embedding Generation                              │  │
│  │    - OpenAI text-embedding-3-small (1536 dims)       │  │
│  │    - OR Voyage AI (better for commerce)             │  │
│  │    - Batch processing (up to 100 items/request)     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │ 3. Vector Storage                                    │  │
│  │    - pgvector (MVP): PostgreSQL extension           │  │
│  │    - Pinecone (Scale): Managed vector DB            │  │
│  │    - Metadata filtering (price range, category)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────┐
│                    RETRIEVAL SYSTEM                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Query Processing                                     │  │
│  │  1. Embed user query                                 │  │
│  │  2. Extract filters from intent (price, category)    │  │
│  │  3. Semantic search (cosine similarity)              │  │
│  │  4. Hybrid search (keyword + semantic)               │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │ Reranking                                            │  │
│  │  - Rerank by: price, availability, popularity        │  │
│  │  - Boost: products in current cart                   │  │
│  │  - Penalize: out of stock                           │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │ Context Assembly                                     │  │
│  │  - Top K products (K=5)                              │  │
│  │  - Relevant policies                                │  │
│  │  - Related FAQs                                      │  │
│  │  - Format for LLM context                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Storage Structure

**Products Table (Extended):**
```sql
ALTER TABLE products 
  ADD COLUMN conversational_description TEXT,
  ADD COLUMN voice_description VARCHAR(500),
  ADD COLUMN search_keywords TEXT[],
  ADD COLUMN sales_objections JSONB,
  ADD COLUMN upsell_triggers JSONB,
  ADD COLUMN vector_indexed_at TIMESTAMPTZ;
```

**Product Embeddings (pgvector):**
```sql
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    chunk_index INTEGER DEFAULT 0,  -- For long descriptions split into chunks
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536),  -- OpenAI dimensions
    metadata JSONB,  -- {price, category, tags, availability}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, chunk_index)
);

-- IVFFlat index for fast approximate nearest neighbor search
CREATE INDEX product_embeddings_vector_idx 
  ON product_embeddings 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Metadata filters
CREATE INDEX product_embeddings_metadata_idx 
  ON product_embeddings 
  USING GIN (metadata jsonb_path_ops);
```

**Policy/FAQ Knowledge Base:**
```sql
CREATE TABLE knowledge_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type VARCHAR(50),  -- 'policy', 'faq', 'guide'
    title VARCHAR(500),
    content TEXT,
    embedding VECTOR(1536),
    metadata JSONB,  -- {category, tags, priority}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX knowledge_articles_vector_idx 
  ON knowledge_articles 
  USING ivfflat (embedding vector_cosine_ops);
```

### Indexing Pipeline

**Background Job (Dramatiq):**
```python
# /server/polar/agent_knowledge/tasks.py
@actor(priority=TaskPriority.LOW)
async def index_product(product_id: UUID) -> None:
    """Generate and store embeddings for a product"""
    async with AsyncSessionMaker() as session:
        product = await product_repo.get_by_id(session, product_id)
        
        # Generate embedding text
        text = generate_embedding_text(product)
        
        # Call OpenAI embeddings API
        embedding = await embedding_service.embed(text)
        
        # Store in vector database
        await vector_store.upsert(
            id=f"product_{product.id}",
            embedding=embedding,
            metadata={
                "product_id": str(product.id),
                "name": product.name,
                "price": product.price_amount,
                "currency": product.price_currency,
                "category": product.category,
                "in_stock": product.in_stock,
                "organization_id": str(product.organization_id)
            }
        )
        
        # Update product
        product.vector_indexed_at = datetime.now()
        await session.flush()

def generate_embedding_text(product: Product) -> str:
    """Create rich text for embedding"""
    parts = [
        f"Product: {product.name}",
        f"Description: {product.conversational_description or product.description}",
        f"Category: {product.category}",
        f"Price: {format_price(product.price_amount, product.price_currency)}"
    ]
    
    if product.attributes:
        attrs = ", ".join(f"{k}: {v}" for k, v in product.attributes.items())
        parts.append(f"Attributes: {attrs}")
    
    if product.search_keywords:
        parts.append(f"Keywords: {', '.join(product.search_keywords)}")
    
    return "\n".join(parts)
```

**Batch Indexing (for initial setup):**
```python
@actor
async def reindex_all_products(organization_id: UUID) -> None:
    """Reindex entire product catalog"""
    async with AsyncSessionMaker() as session:
        products = await product_repo.list_by_organization(
            session, organization_id
        )
        
        # Process in batches of 100
        for batch in chunked(products, 100):
            # Generate embeddings in parallel
            texts = [generate_embedding_text(p) for p in batch]
            embeddings = await embedding_service.embed_batch(texts)
            
            # Bulk insert
            await vector_store.upsert_batch([
                {
                    "id": f"product_{p.id}",
                    "embedding": emb,
                    "metadata": {
                        "product_id": str(p.id),
                        "name": p.name,
                        "price": p.price_amount,
                        "organization_id": str(organization_id)
                    }
                }
                for p, emb in zip(batch, embeddings)
            ])
```

### Retrieval Service

```python
# /server/polar/agent_knowledge/service.py
class KnowledgeRetrievalService:
    """RAG retrieval for agent context"""
    
    async def search_products(
        self,
        query: str,
        organization_id: UUID,
        filters: dict | None = None,
        limit: int = 5
    ) -> list[Product]:
        """Semantic product search"""
        
        # 1. Embed query
        query_embedding = await self.embedding_service.embed(query)
        
        # 2. Vector search with filters
        metadata_filter = {"organization_id": str(organization_id)}
        if filters:
            if "price_max" in filters:
                metadata_filter["price"] = {"$lte": filters["price_max"]}
            if "category" in filters:
                metadata_filter["category"] = filters["category"]
        
        results = await self.vector_store.search(
            embedding=query_embedding,
            filter=metadata_filter,
            limit=limit * 2  # Get more for reranking
        )
        
        # 3. Hybrid search (combine with keyword search)
        keyword_results = await self.keyword_search(query, organization_id)
        combined = self._merge_results(results, keyword_results)
        
        # 4. Rerank
        reranked = self._rerank(combined, filters)
        
        # 5. Fetch full product objects
        product_ids = [r["metadata"]["product_id"] for r in reranked[:limit]]
        products = await product_repo.get_by_ids(product_ids)
        
        return products
    
    def _rerank(self, results: list, filters: dict | None) -> list:
        """Rerank by business logic"""
        scored = []
        
        for result in results:
            score = result["score"]
            metadata = result["metadata"]
            
            # Boost in-stock items
            if metadata.get("in_stock"):
                score *= 1.2
            
            # Boost items matching price preference
            if filters and "price_max" in filters:
                if metadata["price"] <= filters["price_max"]:
                    score *= 1.1
            
            # Penalize out-of-stock
            if not metadata.get("in_stock"):
                score *= 0.5
            
            scored.append({"score": score, **result})
        
        return sorted(scored, key=lambda x: x["score"], reverse=True)
    
    async def get_relevant_policies(
        self,
        query: str,
        organization_id: UUID,
        limit: int = 3
    ) -> list[KnowledgeArticle]:
        """Retrieve relevant policy/FAQ articles"""
        query_embedding = await self.embedding_service.embed(query)
        
        results = await self.vector_store.search(
            collection="knowledge_articles",
            embedding=query_embedding,
            filter={"organization_id": str(organization_id)},
            limit=limit
        )
        
        return [self._hydrate_article(r) for r in results]
```

### Caching Strategy

**Redis Cache:**
```python
class CachedKnowledgeService:
    """Cache frequent queries"""
    
    async def search_products(self, query: str, org_id: UUID, **kwargs):
        # Generate cache key
        cache_key = f"knowledge:search:{org_id}:{hash(query)}:{hash(str(kwargs))}"
        
        # Check cache (TTL: 1 hour)
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Fetch from RAG
        results = await self.knowledge_service.search_products(
            query, org_id, **kwargs
        )
        
        # Cache results
        await redis.setex(
            cache_key,
            3600,  # 1 hour
            json.dumps([p.dict() for p in results])
        )
        
        return results
```

---

## 6. Multi-Agent Orchestration Model

### Agent Types

**1. Sales Agent** (Primary - product discovery, conversion)
**2. Support Agent** (FAQs, troubleshooting, policies)
**3. Payment Agent** (Checkout, payment issues, refunds)

### Orchestration Architecture

```
┌────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Intent Router                                    │ │
│  │                                                  │ │
│  │ if intent in [PRODUCT_QUERY, PURCHASE_INTENT]:  │ │
│  │     route_to(SalesAgent)                        │ │
│  │                                                  │ │
│  │ elif intent in [SUPPORT_REQUEST, FAQ]:          │ │
│  │     route_to(SupportAgent)                      │ │
│  │                                                  │ │
│  │ elif intent in [PAYMENT_ISSUE, REFUND]:         │ │
│  │     route_to(PaymentAgent)                      │ │
│  │                                                  │ │
│  │ else:                                            │ │
│  │     route_to(SalesAgent)  # Default             │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│   Sales    │  │  Support   │  │  Payment   │
│   Agent    │  │  Agent     │  │  Agent     │
│            │  │            │  │            │
│ Tools:     │  │ Tools:     │  │ Tools:     │
│ • Product  │  │ • FAQ KB   │  │ • Stripe   │
│   Lookup   │  │ • Policy   │  │   API      │
│ • Price    │  │   Lookup   │  │ • Refund   │
│   Calc     │  │ • Ticket   │  │   Service  │
│ • Checkout │  │   Create   │  │ • Order    │
│            │  │            │  │   Lookup   │
└────────────┘  └────────────┘  └────────────┘
       │               │               │
       └───────────────┴───────────────┘
                       │
              Shared Context Store
                  (Redis)
```

### Implementation

**Orchestrator Service:**
```python
class MultiAgentOrchestrator:
    """Routes messages to specialized agents"""
    
    def __init__(self):
        self.agents = {
            "sales": SalesAgent(),
            "support": SupportAgent(),
            "payment": PaymentAgent()
        }
        self.context_store = ContextStore()  # Redis-backed
    
    async def process_message(
        self,
        conversation_id: UUID,
        message: str,
        session: AsyncSession
    ) -> AgentResponse:
        # 1. Load conversation context
        context = await self.context_store.get(conversation_id)
        
        # 2. Classify intent
        intent_result = await intent_classifier.classify(message, context)
        
        # 3. Route to appropriate agent
        agent_type = self._route(intent_result.intent)
        agent = self.agents[agent_type]
        
        # 4. Process with selected agent
        response = await agent.process(
            message=message,
            intent=intent_result,
            context=context,
            session=session
        )
        
        # 5. Update shared context
        await self.context_store.update(
            conversation_id,
            agent_type=agent_type,
            last_intent=intent_result.intent,
            agent_state=response.state_update
        )
        
        return response
    
    def _route(self, intent: Intent) -> str:
        """Intent → Agent Type mapping"""
        routing_map = {
            Intent.PRODUCT_QUERY: "sales",
            Intent.PURCHASE_INTENT: "sales",
            Intent.PRICE_NEGOTIATION: "sales",
            Intent.CHECKOUT_READY: "sales",
            
            Intent.SUPPORT_REQUEST: "support",
            Intent.FAQ: "support",
            Intent.SHIPPING_QUESTION: "support",
            Intent.RETURN_REQUEST: "support",
            
            Intent.PAYMENT_ISSUE: "payment",
            Intent.REFUND_REQUEST: "payment",
            Intent.ORDER_STATUS: "payment"
        }
        return routing_map.get(intent, "sales")  # Default to sales
```

**Sales Agent:**
```python
class SalesAgent(BaseAgent):
    """Specialized in product discovery and conversion"""
    
    async def process(
        self,
        message: str,
        intent: IntentResult,
        context: ConversationContext,
        session: AsyncSession
    ) -> AgentResponse:
        # Use Agent Core layers for sales logic
        if intent.intent == Intent.PRODUCT_QUERY:
            return await self.handle_product_search(intent, context, session)
        
        elif intent.intent == Intent.PURCHASE_INTENT:
            return await self.handle_purchase(intent, context, session)
        
        elif intent.intent == Intent.PRICE_NEGOTIATION:
            return await self.handle_negotiation(intent, context, session)
    
    async def handle_product_search(
        self, intent, context, session
    ) -> AgentResponse:
        # Search products via RAG
        products = await knowledge_service.search_products(
            query=intent.entities.get("query"),
            organization_id=context.organization_id,
            filters=intent.entities.get("filters")
        )
        
        # Generate response
        return AgentResponse(
            text="I found these great options for you:",
            product_cards=[ProductCard.from_model(p) for p in products],
            state_update={"last_products": [p.id for p in products]}
        )
```

**Support Agent:**
```python
class SupportAgent(BaseAgent):
    """Handles FAQs, policies, troubleshooting"""
    
    async def process(self, message, intent, context, session):
        # Search knowledge base
        articles = await knowledge_service.get_relevant_policies(
            query=message,
            organization_id=context.organization_id
        )
        
        # Generate answer from articles
        answer = await self.generate_answer(message, articles)
        
        # Escalate to human if confidence low
        if answer.confidence < 0.7:
            return await self.escalate_to_human(context)
        
        return AgentResponse(
            text=answer.text,
            sources=[a.title for a in articles]
        )
```

**Payment Agent:**
```python
class PaymentAgent(BaseAgent):
    """Handles payment, orders, refunds"""
    
    async def process(self, message, intent, context, session):
        if intent.intent == Intent.ORDER_STATUS:
            return await self.check_order_status(intent, context, session)
        
        elif intent.intent == Intent.REFUND_REQUEST:
            return await self.initiate_refund(intent, context, session)
    
    async def check_order_status(self, intent, context, session):
        order_id = intent.entities.get("order_id")
        order = await order_service.get(session, order_id)
        
        return AgentResponse(
            text=f"Your order #{order.invoice_number} is {order.status}. "
                 f"Estimated delivery: {order.estimated_delivery}"
        )
```

### Agent Context Sharing

**Shared Context Store (Redis):**
```python
class ContextStore:
    """Shared memory across agents"""
    
    async def get(self, conversation_id: UUID) -> ConversationContext:
        key = f"conversation:{conversation_id}:context"
        data = await redis.get(key)
        return ConversationContext(**json.loads(data)) if data else ConversationContext()
    
    async def update(
        self,
        conversation_id: UUID,
        **updates
    ) -> None:
        key = f"conversation:{conversation_id}:context"
        context = await self.get(conversation_id)
        
        # Merge updates
        for k, v in updates.items():
            setattr(context, k, v)
        
        # Save
        await redis.setex(
            key,
            7 * 24 * 3600,  # 7 days
            json.dumps(context.dict())
        )
```

**Preventing Hallucinations:**
1. **Grounded Responses**: Always cite sources (product data, policies)
2. **Confidence Thresholds**: Escalate when uncertain
3. **Tool-Based Actions**: Use tools, not LLM imagination (for prices, stock)
4. **Template Fallbacks**: Use templates for critical paths (checkout)

---

## 7. 90-Day Development Roadmap

### Phase 1: Foundations (Weeks 1-3)

**Week 1: Setup & Cleanup**
- [ ] Fork Polar repository
- [ ] Remove unused modules (GitHub, ads, subscriptions)
- [ ] Create AgentPay-specific README
- [ ] Set up development environment
- [ ] Database cleanup migration
- [ ] Document architecture decisions
- **Deliverable**: Clean Polar fork ready for AgentPay extensions

**Week 2: Agent Core Foundation**
- [ ] Create `/server/polar/agent/` module
- [ ] Implement Agent, Conversation, Message models
- [ ] Build intent classification service (hybrid)
- [ ] Set up basic API endpoints (`/conversations`, `/messages`)
- [ ] Implement state management (Redis)
- **Deliverable**: Basic conversation API working

**Week 3: LLM Integration**
- [ ] Anthropic Claude integration
- [ ] OpenAI embeddings integration
- [ ] Intent classifier with LLM fallback
- [ ] Response generation (template-based)
- [ ] Unit tests for agent core
- **Deliverable**: Agent can classify intents and respond

### Phase 2: Agent Intelligence (Weeks 4-6)

**Week 4: RAG System (Products)**
- [ ] Extend Product model with conversational fields
- [ ] Build embedding generation service
- [ ] Set up pgvector (or Pinecone)
- [ ] Create product indexing background job
- [ ] Implement semantic search
- **Deliverable**: Agent can search products via RAG

**Week 5: Tool System**
- [ ] Build Tool Registry pattern
- [ ] Implement ProductLookupTool (RAG search)
- [ ] Implement VariantSelectorTool
- [ ] Implement InventoryCheckerTool
- [ ] Implement ShippingCalculatorTool
- **Deliverable**: Agent can invoke tools to get data

**Week 6: Context & Knowledge**
- [ ] Build context enrichment service
- [ ] Index policies/FAQs in knowledge base
- [ ] Implement hybrid search (keyword + semantic)
- [ ] Build caching layer (Redis)
- [ ] Create reranking logic
- **Deliverable**: Agent has full knowledge base access

### Phase 3: Conversational Commerce (Weeks 7-9)

**Week 7: Conversational Checkout**
- [ ] Create ConversationCheckout model
- [ ] Extend Checkout service for multi-turn flow
- [ ] Implement dynamic pricing engine
- [ ] Create AgentPriceOffer model & service
- [ ] Build negotiation logic
- **Deliverable**: Agent can negotiate prices

**Week 8: Payment Integration**
- [ ] PaymentLinkTool (generates Stripe links)
- [ ] Webhook handlers for payment events
- [ ] Conversation updates on payment success/fail
- [ ] Background jobs for order confirmation
- [ ] Email notifications
- **Deliverable**: End-to-end purchase flow works

**Week 9: Multi-Agent Orchestration**
- [ ] Build MultiAgentOrchestrator
- [ ] Implement SalesAgent
- [ ] Implement SupportAgent
- [ ] Implement PaymentAgent
- [ ] Shared context store
- **Deliverable**: Agent routing works

### Phase 4: Frontend & Polish (Weeks 10-12)

**Week 10: Chat Widget**
- [ ] Build embed script (vanilla JS)
- [ ] Create React chat UI components
- [ ] Implement WebSocket connection
- [ ] Product cards, payment buttons
- [ ] Theming support (light/dark)
- **Deliverable**: Chat widget functional

**Week 11: Merchant Dashboard**
- [ ] Conversation list view
- [ ] Conversation detail view (transcript)
- [ ] Agent configuration UI
- [ ] Knowledge base management
- [ ] Analytics dashboard
- **Deliverable**: Merchants can monitor conversations

**Week 12: Testing & Launch Prep**
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation (merchant onboarding)
- [ ] Deploy to staging
- [ ] Beta merchant onboarding
- **Deliverable**: Production-ready MVP

### Deliverables Summary

**Week 3**: Agent can have basic conversations
**Week 6**: Agent knows about products and policies
**Week 9**: Agent can negotiate and process payments
**Week 12**: Full conversational commerce platform live

---

## 8. Risk Assessment + De-Risk Strategies

### Technical Risks

**HIGH RISK: LLM Reliability**
- **Issue**: LLMs hallucinate, make pricing errors, give wrong information
- **Impact**: Lost sales, merchant distrust, refunds
- **Mitigation**:
  - ✅ Use tools for critical data (prices, stock) - never LLM-generated
  - ✅ Template-based responses for checkout/payment
  - ✅ Confidence thresholds (escalate to human if < 0.7)
  - ✅ Audit logs for all agent decisions
  - ✅ Merchant approval for discounts > 15%

**HIGH RISK: Payment Processing Errors**
- **Issue**: Webhook failures, double charges, lost payments
- **Impact**: Financial loss, legal issues
- **Mitigation**:
  - ✅ Use Polar's battle-tested payment infrastructure
  - ✅ Idempotency keys for all Stripe calls
  - ✅ Retry logic with exponential backoff
  - ✅ Transaction ledger (double-entry accounting)
  - ✅ Daily reconciliation jobs

**MEDIUM RISK: Polar Dependency**
- **Issue**: Polar changes break AgentPay, or project abandoned
- **Impact**: Maintenance burden, security vulnerabilities
- **Mitigation**:
  - ✅ Fork at stable release (not main branch)
  - ✅ Monitor Polar repo for security patches
  - ✅ Document all extensions/modifications
  - ✅ Test suite to catch breaking changes

**MEDIUM RISK: RAG Quality**
- **Issue**: Poor search results, irrelevant products
- **Impact**: Bad customer experience, low conversion
- **Mitigation**:
  - ✅ Hybrid search (keyword + semantic)
  - ✅ Reranking by business rules
  - ✅ A/B test embeddings models
  - ✅ Manual curation for top products

**MEDIUM RISK: Scalability**
- **Issue**: LLM API rate limits, database bottlenecks
- **Impact**: Slow responses, downtime
- **Mitigation**:
  - ✅ LLM provider fallbacks (Anthropic → OpenAI)
  - ✅ Caching (Redis) for frequent queries
  - ✅ Background jobs for heavy processing
  - ✅ Database read replicas

**LOW RISK: Embed Widget Compatibility**
- **Issue**: Widget breaks on some merchant sites
- **Impact**: Installation friction
- **Mitigation**:
  - ✅ Iframe isolation (prevents CSS conflicts)
  - ✅ PostMessage API (secure cross-origin)
  - ✅ Compatibility testing (major CMSs)

### Business Risks

**HIGH RISK: Merchant Adoption**
- **Issue**: Merchants don't see value, churn
- **Impact**: Revenue loss, wasted development
- **De-Risk**:
  - ✅ Beta with 5-10 friendly merchants
  - ✅ Track conversion lift (need ≥15% improvement)
  - ✅ Show ROI dashboard (sales via agent)
  - ✅ Onboarding support (white-glove first 10)

**MEDIUM RISK: Customer Trust**
- **Issue**: Customers don't trust AI agent
- **Impact**: Low engagement, abandoned carts
- **De-Risk**:
  - ✅ Transparent AI labeling ("Powered by AI")
  - ✅ Easy escalation to human
  - ✅ Trust signals (secure checkout badges)
  - ✅ Merchant branding (not generic bot)

**LOW RISK: Regulatory Compliance**
- **Issue**: GDPR, data privacy violations
- **Impact**: Fines, legal trouble
- **De-Risk**:
  - ✅ Data minimization (don't store PII unnecessarily)
  - ✅ Right to deletion (GDPR compliance)
  - ✅ Privacy policy transparency
  - ✅ Polar's existing compliance (Stripe handles PCI)

---

## 9. Final Recommendation

### Summary: Build on Polar Foundation ⭐⭐⭐⭐⭐

**Why This is the Right Choice:**

1. **Speed**: 8-10 weeks to MVP (vs 16-20 weeks from scratch)
2. **De-Risked Payments**: Proven Stripe integration, tax compliance, accounting
3. **Focus**: Spend time on Agent Core (your competitive advantage), not plumbing
4. **Multi-Tenancy**: SaaS-ready from day 1
5. **Cost**: Save $120K-$180K in engineering time

**What You're Getting:**
- Battle-tested payment infrastructure
- Multi-currency, multi-tenant architecture
- Transaction accounting system
- Background job processing
- API authentication & authorization
- 60-70% of the platform pre-built

**What You're Building:**
- Agent Core (6-layer conversation engine)
- RAG knowledge system
- Multi-agent orchestration
- Dynamic pricing & negotiation
- Conversational checkout flow
- Astro-compatible chat widget

**Action Plan:**

**Next 7 Days:**
1. Fork Polar repository
2. Set up local development environment
3. Remove unused modules (GitHub, subscriptions, ads)
4. Create first Agent model migration

**Next 30 Days:**
5. Build Agent Core foundation (Weeks 1-4 of roadmap)
6. LLM integration (Anthropic + OpenAI)
7. Basic RAG system (product search)
8. First conversational flow working

**Next 90 Days:**
9. Complete conversational commerce MVP
10. Beta with 5-10 merchants
11. Measure conversion lift
12. Iterate based on feedback

**Long-Term (6-12 Months):**
- WhatsApp integration
- Multi-language support
- Advanced multi-agent features
- PIX/Wise payment rails (Brazil, international)
- Voice commerce (phone calls)

### Why NOT to Build from Scratch:

You'd spend 4-6 months building payment infrastructure that:
- Already exists (Polar)
- Is complex (tax, accounting, refunds)
- Isn't differentiated (everyone needs payments)
- Diverts focus from your core innovation (Agent Core)

**Polar gives you a 2-3 month head start. Use it.**

### Immediate Next Steps:

```bash
# 1. Fork Polar
gh repo fork polarsource/polar muriloscigliano/agentpay

# 2. Clone locally
git clone https://github.com/muriloscigliano/agentpay
cd agentpay

# 3. Set up development environment
cd server
docker compose up -d  # PostgreSQL, Redis, MinIO
uv sync
uv run task db_recreate
uv run task emails
uv run task api  # Start backend

# 4. Create first AgentPay migration
uv run alembic revision --autogenerate -m "Add Agent Core models"
```

**Let's build AgentPay. The infrastructure is ready. Now focus on making the agent brilliant.**

---

## Appendix: Quick Reference

### Key Technologies
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis, Dramatiq
- **LLMs**: Anthropic Claude (primary), OpenAI (embeddings, fallback)
- **Payments**: Stripe (via Polar)
- **Vector DB**: pgvector (MVP), Pinecone (scale)
- **Frontend**: React, Astro (merchant sites)
- **Real-time**: WebSocket, SSE

### Critical Files to Study
- `/server/polar/checkout/service.py` - Checkout flow
- `/server/polar/payment/service.py` - Payment handling
- `/server/polar/order/service.py` - Order management
- `/server/polar/integrations/stripe/` - Stripe integration
- `/clients/packages/checkout/src/embed.ts` - Embed pattern

### Performance Targets
- Chat response time: < 2s (90th percentile)
- Widget load time: < 500ms (initial), < 2s (full chat)
- Conversation capacity: 1K concurrent (MVP), 10K (scale)
- Uptime: 99.9%

### Success Metrics (90 Days)
- **5-10 beta merchants** onboarded
- **≥15% conversion lift** vs baseline
- **<3s average** response time
- **>4.0/5.0** merchant satisfaction
- **>80% customer** engagement rate (start conversation)

---

**END OF ANALYSIS**

*Document Prepared By: Senior Software Architect, AI Systems Engineer, Payments Infrastructure Specialist*
*Date: 2025-01-17*
*Version: 1.0*

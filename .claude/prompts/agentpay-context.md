# AgentPay Context

## What is AgentPay?

AgentPay is an AI-native transaction orchestrator that enables autonomous or semi-autonomous agents — human or digital — to handle conversational payments, invoicing, and financial tracking across global payment rails.

### Vision Statement
"Wherever intent is expressed, payment can be understood, negotiated, and completed — intelligently and transparently."

## Core Principles

### 1. Conversational-First
Payment flows should happen naturally within conversations, not as separate journeys requiring context switching.

### 2. AI-Native
Built from the ground up to support AI agents as first-class actors in the payment ecosystem, alongside humans.

### 3. Adaptive Intelligence
The system learns and adapts to user patterns, preferences, and contexts to provide increasingly intelligent orchestration.

### 4. Trust Through Transparency
Every decision, fee, and action is explainable in human terms. Users always understand what's happening and why.

### 5. Global by Default
Support multiple currencies, payment rails, and regulatory frameworks without requiring users to understand the complexity.

## Problem Space

### Current Pain Points

1. **Fragmented Payment Journeys**
   - Conversations on WhatsApp/Slack → Payment links in another app → Manual tracking in spreadsheets
   - Context-switching kills flow and creates anxiety over missing payments

2. **Unclear Trust & Verification**
   - "Is this the right link?" "Did they pay?" "Who processed this?"
   - Loss of confidence leads to delayed transactions

3. **Cognitive Overload**
   - Users juggle multiple tools for communication, payment, and accounting
   - Time drain and mental fatigue

4. **Cross-Border Complexity**
   - Freelancers and SMBs use multiple services (Wise, PayPal, Stripe)
   - Each with different fees, delays, and manual entry requirements
   - Profit erosion and confusion

### The Opportunity

We're moving from transactional commerce to conversational, agentic commerce:

- 70% of SMBs in emerging markets conduct business on WhatsApp or social platforms
- Freelancers globally use 5+ tools to manage one transaction
- AI agents (ChatGPT, Claude, etc.) are starting to negotiate and buy on behalf of humans
- There's no "financial execution layer" for the agent economy — yet

## Target Users

### Primary Personas

1. **Freelancers & Solopreneurs**
   - Need: Simple invoicing, fast payments, automatic tracking
   - Pain: Manual invoice creation, chasing payments, reconciliation
   - Platforms: WhatsApp, email, project management tools

2. **SMB Owners**
   - Need: Customer payment collection, expense tracking, cash flow visibility
   - Pain: Multiple payment methods, manual reconciliation, accounting sync
   - Platforms: WhatsApp, Slack, accounting software

3. **AI Agents**
   - Need: Execute payments on behalf of users, verify transactions, maintain audit trail
   - Pain: No payment execution capability, trust verification, compliance
   - Platforms: API integration

### Secondary Personas

4. **SaaS Platforms**
   - Need: Embedded payment capability in their product
   - Pain: Building payment infrastructure, compliance, multiple rails
   - Integration: SDK/API

5. **Group Coordinators**
   - Need: Split payments, track who paid, automatic reminders
   - Pain: Manual calculation, chasing people, lost money
   - Platforms: WhatsApp, Slack, Telegram

## Key Differentiators

| Aspect | Legacy Fintech | AgentPay |
|--------|---------------|----------|
| UX | Web-first | Conversation-first |
| Logic | Static | Context-aware |
| Flow | Linear | Adaptive |
| Trust | Hidden | Explainable |
| AI Role | External | Native actor |
| Value | Speed | Understanding + Control |

## Business Model

### Revenue Streams

1. **Conversational Payments** - Subscription for SMBs & freelancers
   - "Smart PIX" Agent for WhatsApp
   - Pricing: $29-99/month based on transaction volume

2. **Adaptive API Layer** - Transaction fee for embedded SDK
   - SaaS integrates Adaptive Checkout
   - Pricing: 0.5% per transaction or fixed monthly fee

3. **Cross-Border Routing** - Percentage of optimized transfers
   - Freelancer payment Brazil ↔ Australia
   - Pricing: Share of savings vs traditional methods

4. **Trust Data & Insights** - Analytics subscription
   - SaaS dashboards on user confidence & flow
   - Pricing: $199-999/month

## Technical Foundation (Building on Polar)

### What We Inherit from Polar

- ✅ **Authentication System** - User, Organization, Customer auth
- ✅ **Database Infrastructure** - PostgreSQL with Alembic migrations
- ✅ **Background Jobs** - Dramatiq workers
- ✅ **File Storage** - S3/Minio integration
- ✅ **Stripe Integration** - Payment processing foundation
- ✅ **API Framework** - FastAPI with service/repository pattern

### What We Build (AgentPay Extensions)

- 🆕 **Intent Recognition** - NLU for conversational payments
- 🆕 **Payment Orchestration** - Multi-rail routing and optimization
- 🆕 **Messaging Adapters** - WhatsApp, Slack, Telegram integrations
- 🆕 **Trust & Transparency** - Explainability engine, compliance framework
- 🆕 **Context Memory** - Relationship graphs, pattern detection
- 🆕 **Accounting Sync** - QuickBooks, Xero, Conta Azul integration

## Success Metrics

### Product Metrics
- Payment completion rate: +40% vs static links
- Time-to-pay: -70% (from 48h to <15min)
- Trust NPS: +30% increase
- Manual reconciliation: -90% reduction
- User retention: +25% through conversational engagement

### Technical Metrics
- API latency p95: < 500ms
- Intent classification accuracy: > 95%
- Payment success rate: > 99%
- System uptime: 99.9%

### Business Metrics
- Monthly Recurring Revenue (MRR) growth
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Transaction volume
- Average transaction size

## Emotional Impact

Money is not just transactional — it's emotional.

Every time someone sends, receives, or waits for money, they feel:
- **Uncertainty** - "Did it go through?"
- **Vulnerability** - "Can I trust this?"
- **Cognitive fatigue** - "Why do I need five apps to do one task?"

### AgentPay's Emotional Promise

**Restore trust, clarity, and emotional flow in the financial experience.**

It's not just AI that moves money.
It's AI that understands why it's moving.

## Regulatory Landscape

### Brazil (PIX)
- Instant payment system
- KYC required for transactions > R$ 10,000
- Report suspicious transactions to COAF (Brazilian FIU)
- Regulated by Central Bank of Brazil

### Australia (PayTo)
- Real-time account-to-account payments
- AUSTRAC regulations for AML/CTF
- KYC requirements
- Report to AUSTRAC

### Europe (SEPA)
- GDPR compliance mandatory
- PSD2 Strong Customer Authentication
- Report to national Financial Intelligence Units
- Open Banking APIs

### United States
- FinCEN regulations
- PATRIOT Act compliance
- State-level money transmitter licenses
- ACH network rules

## Competitive Landscape

### Direct Competitors
- **Stripe** - Payment processing, lacks conversational layer
- **PayPal** - Established brand, not AI-native
- **Wise** - Cross-border transfers, manual flow
- **MercadoPago** (LATAM) - Strong in LatAm, transactional focus

### Adjacent Players
- **Intercom/Zendesk** - Conversational platforms, no payments
- **QuickBooks/Xero** - Accounting, no conversational interface
- **ChatGPT/Claude** - AI agents, no payment execution

### AgentPay's Position
**We don't compete — we complete.**

We orchestrate existing payment rails and integrate with existing platforms, providing the missing conversational and agentic layer.

## Development Philosophy

### Code Quality
- Keep comments minimal - code should be self-explanatory
- Follow Polar's modular structure (service/repository pattern)
- Proper async/await patterns
- Never call `session.commit()` directly in business logic

### Testing
- Unit tests for all business logic
- Integration tests for external APIs (use mocks in CI)
- E2E tests for critical user flows
- Performance tests for orchestration layer

### Documentation
- Skills-based documentation for Claude Code
- API documentation auto-generated from code
- User-facing docs focused on outcomes, not features

### Deployment
- Continuous deployment to staging
- Feature flags for gradual rollout
- Monitor error rates and performance
- Rollback capability for all releases

## Next Steps

See `AGENTPAY_IMPLEMENTATION_PLAN.md` for detailed implementation roadmap.

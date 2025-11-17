# AgentPay Codebase Cleanup Log

**Date Started:** 2025-01-17
**Week:** 1 Day 1
**Goal:** Remove Polar-specific modules not needed for AgentPay conversational commerce

## Modules to Remove

### Polar-Specific Features (Not Needed)
- [x] `pledge/` - Issue funding (Polar crowdfunding feature)
- [ ] `integrations/github/` - GitHub OAuth and repository integration
- [ ] `integrations/github_repository_benefit/` - GitHub benefits
- [ ] `campaign/` - Campaigns/sponsorships
- [ ] `license_key/` - Software license management
- [ ] `storefront/` - Public storefront (replaced by chat widget)

### Keep But Skip for MVP (Phase 2)
- `subscription/` - Keep for future recurring billing (AgentPay subscriptions)

### Essential Modules (Keep)
- `checkout/`, `checkout_link/` - Payment flow ✅
- `payment/`, `payment_method/` - Payment processing ✅
- `order/`, `invoice/` - Order management ✅
- `product/` - Product catalog ✅
- `customer/` - Customer management ✅
- `discount/`, `refund/` - Commerce features ✅
- `transaction/` - Double-entry accounting ✅
- `organization/` - Multi-tenancy ✅
- `integrations/stripe/` - Payment processor ✅
- `webhook/`, `event/` - Event system ✅
- Infrastructure modules (auth, kit, models, worker, etc.) ✅

## Cleanup Strategy: Non-Destructive Approach

**Decision:** Instead of deleting Polar modules, we'll use a **non-destructive** approach:
1. **Document inactive modules** (don't use, but keep for reference)
2. **Build new AgentPay modules** alongside Polar
3. **Extend existing modules** with new fields/methods
4. **Disable API routes** we don't need (via config)

**Why:** Safer, allows referencing Polar patterns, avoids complex database migrations

## Cleanup Progress

### Step 1: Document Inactive Modules
Status: In Progress

Modules marked as INACTIVE (keep files, don't use):
- `pledge/` - Issue funding ❌ Not used in AgentPay
- `campaign/` - Campaigns ❌ Not used in AgentPay
- `license_key/` - Licenses ❌ Not used in AgentPay
- `storefront/` - Public storefront ❌ Replaced by chat widget
- `integrations/github/` - GitHub ❌ Not used in AgentPay
- `integrations/github_repository_benefit/` - GitHub benefits ❌ Not used

Modules marked as FUTURE (keep, use in Phase 2):
- `subscription/` - ⏳ Use in Phase 2 for recurring AgentPay subscriptions

### Step 2: Create AgentPay Module Structure
Status: Next

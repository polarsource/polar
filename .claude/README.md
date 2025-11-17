# Claude Code Skills for AgentPay

This directory contains specialized skills and context for building AgentPay with Claude Code.

## What is AgentPay?

AgentPay is an AI-native payment orchestration platform built on the Polar infrastructure. It enables conversational payments across messaging platforms like WhatsApp, Slack, and Telegram, with intelligent routing across multiple payment rails (PIX, Stripe, Wise, etc.).

**Vision**: "Wherever intent is expressed, payment can be understood, negotiated, and completed — intelligently and transparently."

## Directory Structure

```
.claude/
├── README.md                          # This file
├── skills/                            # Domain-specific development skills
│   ├── payment-orchestration.md       # Multi-rail payment routing
│   ├── intent-recognition.md          # NLU for conversational payments
│   ├── architecture-design.md         # System architecture patterns
│   ├── conversational-payments.md     # Payment flows in conversations
│   ├── trust-layer.md                 # Explainability & compliance
│   └── api-integration.md             # External API integrations
├── prompts/                           # Context and guidelines
│   ├── agentpay-context.md            # Project context and vision
│   └── development-guidelines.md      # Coding standards and best practices
├── commands/                          # Custom slash commands (NEW!)
│   ├── README.md                      # Commands documentation
│   ├── add-to-agentpay-todos.md       # Enhanced todo management
│   ├── agentpay-prompt.md             # Meta-prompting with context
│   ├── run-agentpay-prompt.md         # Execute prompts + tracking
│   └── agentpay-handoff.md            # Work continuity handoffs
└── TACHES_ANALYSIS.md                 # Analysis of TÂCHES system value
```

## How to Use These Skills

### When Working on Specific Features

Reference the relevant skill to get guidance on implementation:

**Example**: Implementing payment orchestration
```
"I need to implement the payment orchestration service that selects
optimal payment rails. Review .claude/skills/payment-orchestration.md
for guidance."
```

**Example**: Building intent recognition
```
"Help me build the intent classification system. Follow the patterns
in .claude/skills/intent-recognition.md."
```

### Quick Reference Guide

| Task | Skill to Reference |
|------|-------------------|
| Building payment rail adapters | `payment-orchestration.md` |
| Implementing NLU/LLM integration | `intent-recognition.md` |
| Designing system architecture | `architecture-design.md` |
| Creating conversational flows | `conversational-payments.md` |
| Adding compliance/KYC | `trust-layer.md` |
| Integrating external APIs | `api-integration.md` |

### General Development

Always review:
- `prompts/development-guidelines.md` - Coding standards, testing, deployment
- `prompts/agentpay-context.md` - Project vision, principles, business model

## Key Skills Overview

### 1. Payment Orchestration (`payment-orchestration.md`)

**Purpose**: Guide development of intelligent payment routing across multiple rails.

**Key Topics**:
- Payment rail adapter pattern
- Cost calculation and optimization
- Routing decision logic
- Fallback handling
- Integration with Polar

**Use When**:
- Adding new payment rails (PayTo, SEPA, etc.)
- Optimizing rail selection logic
- Debugging payment failures
- Implementing cost calculators

### 2. Intent Recognition (`intent-recognition.md`)

**Purpose**: Build conversational AI to detect payment intent from natural language.

**Key Topics**:
- Intent classification (rule-based + LLM)
- Entity extraction (amounts, dates, currencies)
- Multi-turn conversation context
- Confidence scoring
- Multi-language support

**Use When**:
- Implementing or improving intent detection
- Adding new transaction types
- Optimizing LLM prompts
- Debugging classification errors

### 3. Architecture Design (`architecture-design.md`)

**Purpose**: Guide overall system architecture decisions.

**Key Topics**:
- Layer architecture (messaging → intent → orchestration → trust → memory)
- Database schema design
- API design patterns
- Scalability considerations
- Security architecture

**Use When**:
- Planning new features
- Making architectural decisions
- Optimizing performance
- Planning infrastructure changes

### 4. Conversational Payments (`conversational-payments.md`)

**Purpose**: Implement natural payment flows within messaging platforms.

**Key Topics**:
- Payment flow state machines
- Message rendering for different platforms
- Confirmation handling
- Timeout management
- User experience principles

**Use When**:
- Building new payment flows
- Integrating new messaging platforms
- Improving conversion rates
- Handling edge cases in flows

### 5. Trust Layer (`trust-layer.md`)

**Purpose**: Build explainability, compliance, and fraud detection.

**Key Topics**:
- Explainability engine
- KYC/AML compliance
- Fraud detection
- Audit logging
- Regulatory compliance

**Use When**:
- Implementing compliance features
- Adding fraud detection rules
- Generating explanations
- Meeting regulatory requirements

### 6. API Integration (`api-integration.md`)

**Purpose**: Guide integration with external services.

**Key Topics**:
- Payment rail APIs (PIX, Stripe, Wise)
- Messaging platforms (WhatsApp, Slack)
- Accounting systems (QuickBooks, Xero)
- LLM services (Claude, GPT)

**Use When**:
- Adding new integrations
- Debugging API issues
- Setting up webhooks
- Writing integration tests

## Best Practices

### 1. Read Relevant Skills First

Before implementing a feature, read the relevant skill document. It will:
- Save time by providing proven patterns
- Prevent common mistakes
- Ensure consistency across the codebase
- Guide testing strategy

### 2. Follow Polar's Patterns

AgentPay builds on Polar. Always:
- Use service/repository pattern
- Never call `session.commit()` directly
- Use async/await consistently
- Follow Polar's module structure

See `prompts/development-guidelines.md` for details.

### 3. Reference Skills in Conversations

When working with Claude Code, explicitly reference skills:

Good:
```
"Following the patterns in .claude/skills/payment-orchestration.md,
implement the Wise adapter for cross-border payments."
```

Better:
```
"Review .claude/skills/payment-orchestration.md and
.claude/skills/api-integration.md (Wise section), then implement
the Wise payment rail adapter with proper error handling and tests."
```

### 4. Keep Skills Updated

As the project evolves, update skills to reflect:
- New learnings and patterns
- Updated best practices
- New integrations
- Changed requirements

## Implementation Plans

AgentPay has two implementation tracks:

### 🚀 Web Chat MVP (RECOMMENDED START)

**File**: `AGENTPAY_MVP_PLAN.md`

**Timeline**: 4 weeks
**Scope**: Web chat widget on your e-commerce site
**Goal**: Validate conversational checkout improves conversion

**Why Start Here**:
- Validates hypothesis with real users in 4 weeks
- Low investment (160-240 hours, <$500/month)
- Controlled environment (your website only)
- Foundation for full build if successful

**See Also**: `.claude/skills/web-chat-mvp.md` for technical guidance

### 📚 Full AgentPay Platform

**File**: `AGENTPAY_IMPLEMENTATION_PLAN.md`

**Prerequisites**: Successful MVP validation
**Timeline**: 6 months to full v1.0
**Scope**: Multi-platform (WhatsApp, Slack, Telegram), multi-rail orchestration

The full implementation plan provides:
- Phased approach (Phases 0-6)
- Detailed milestones and tasks
- Success criteria and metrics
- Resource requirements
- Risk mitigation strategies

**Strategy**: Build MVP first, then decide based on data whether to invest in full platform

## Quick Start

### New to the Project?

1. Read `prompts/agentpay-context.md` - Understand the vision
2. Read `prompts/development-guidelines.md` - Learn the standards
3. Review `AGENTPAY_IMPLEMENTATION_PLAN.md` - See the roadmap
4. Set up development environment (see Polar's documentation)

### Starting a New Feature?

1. Find the relevant milestone in the implementation plan
2. Read the related skill documents
3. Review Polar's existing code for similar patterns
4. Implement following the guidelines
5. Write tests (>80% coverage target)
6. Update documentation

### Debugging an Issue?

1. Check relevant skill for troubleshooting guidance
2. Review logs (structured logging)
3. Check metrics/monitoring
4. Consult development guidelines for patterns

## Common Workflows

### Adding a New Payment Rail

```bash
# 1. Review skills
# - payment-orchestration.md
# - api-integration.md

# 2. Create adapter structure
mkdir -p server/polar/payment_orchestration/rails/{rail_name}

# 3. Implement following the adapter pattern
# - client.py (API client)
# - adapter.py (PaymentRailAdapter implementation)
# - webhook_handler.py (webhook processing)

# 4. Add tests
# - Unit tests for adapter
# - Integration tests with sandbox
# - Mock for CI/CD

# 5. Update orchestration service
# - Register new rail
# - Update routing logic
# - Add to capabilities

# 6. Document
# - Update skill if needed
# - Add to implementation plan
```

### Adding a New Messaging Platform

```bash
# 1. Review skills
# - conversational-payments.md
# - api-integration.md

# 2. Create adapter
# server/polar/messaging/adapters/{platform}.py

# 3. Implement PlatformAdapter interface
# - send_message()
# - send_payment_link()
# - send_rich_card()

# 4. Set up webhook endpoint
# - Verify webhook
# - Route to message router
# - Handle platform-specific events

# 5. Create message renderer
# server/polar/conversational_payments/rendering/{platform}_renderer.py

# 6. Test end-to-end
# - Manual testing in sandbox
# - E2E tests
# - Load testing
```

## Custom Commands (NEW!)

AgentPay includes powerful slash commands built on the TÂCHES prompting patterns with project-specific enhancements.

### Available Commands

**`/add-to-agentpay-todos`** - Enhanced todo management
- Captures technical debt with full context
- Priority levels (P0-P3), phase tags, effort estimates
- File paths, line numbers, solution hints
- Duplicate detection and auto-extraction

**`/agentpay-prompt`** - Meta-prompting with context
- Auto-loads AgentPay context, skills, and standards
- Generates optimized XML prompts
- Links to implementation plan milestones
- Supports single/parallel/sequential strategies

**`/run-agentpay-prompt`** - Execute prompts + tracking
- Runs prompts via sub-agents
- Tracks milestone progress
- Validates success criteria
- Archives completed prompts
- Suggests git commits

**`/agentpay-handoff`** - Work continuity handoffs
- Generates comprehensive WHATS-NEXT.md
- Documents completed work and decisions
- Lists remaining tasks and blockers
- Perfect for long sessions or shift handoffs

### Quick Workflow Example

```
# Start new feature
/agentpay-prompt "Implement PIX payment rail"
→ Creates optimized prompt in .prompts/

# Execute it
/run-agentpay-prompt latest
→ Runs via sub-agent, tracks progress

# Discover technical debt
/add-to-agentpay-todos "Optimize PIX QR code caching"
→ Captures for later, returns to current work

# End of day
/agentpay-handoff
→ Creates handoff doc for tomorrow
```

**Full Documentation**: `.claude/commands/README.md`

**Value**: Estimated 20-30% productivity gain through reduced context switching and better task decomposition. See `.claude/TACHES_ANALYSIS.md` for detailed analysis.

---

## Support

### Questions About Implementation?

1. Check the relevant skill document
2. Review Polar's codebase for examples
3. Consult implementation plan for context
4. Ask in team chat with specific questions

### Want to Improve These Skills?

Skills should evolve with the project:

1. Identify gaps or outdated information
2. Update the relevant skill document
3. Submit PR with clear description
4. Get team review
5. Update README if structure changes

## Resources

### Internal
- Implementation Plan: `/AGENTPAY_IMPLEMENTATION_PLAN.md`
- Polar Documentation: `/CLAUDE.md`
- Development Guidelines: `.claude/prompts/development-guidelines.md`

### External
- Polar: https://polar.sh
- FastAPI: https://fastapi.tiangolo.com
- SQLAlchemy: https://www.sqlalchemy.org
- Pydantic: https://docs.pydantic.dev
- Dramatiq: https://dramatiq.io

### APIs
- Anthropic Claude: https://docs.anthropic.com
- WhatsApp Business: https://developers.facebook.com/docs/whatsapp
- Stripe: https://stripe.com/docs/api
- PIX (Brazil): Provider-specific documentation

---

**Remember**: These skills are here to help you build faster and better. Use them as living documentation that evolves with the project.

Happy coding! 🚀

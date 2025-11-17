# ADR 001: Build AgentPay on Polar Foundation

**Status**: Accepted

**Date**: 2025-11-17

**Context**:

We need to build AgentPay, a conversational commerce platform with AI agents. We had two options:

1. **Build from scratch**: Start with a clean architecture tailored for agent-first commerce
2. **Build on Polar**: Leverage Polar's existing payment infrastructure as foundation

Polar provides:
- Mature product catalog models
- Stripe integration with webhook handling
- Organization/user management
- Checkout API
- PostgreSQL + Redis infrastructure
- FastAPI patterns and service layer architecture
- Apache 2.0 license (permissive for commercial use)

**Decision**:

We will **build AgentPay on top of Polar's foundation** using a non-destructive extension approach:

1. **Keep all Polar modules intact** - Do not delete or heavily modify existing code
2. **Build new modules alongside** - Create `agent/`, `agent_conversation/`, `agent_tools/`, `agent_knowledge/` modules
3. **Leverage Polar's patterns** - Follow service/repository pattern, RecordModel, JSONB metadata
4. **Reuse Polar's infrastructure** - Product models, checkout system, Stripe integration
5. **Extend where needed** - Add new fields to existing models via migrations when necessary

**Consequences**:

**Positive**:
- **8-10 week faster delivery** (vs 16-20 weeks from scratch)
- **$120K-$180K cost savings** in development time
- **Battle-tested payment infrastructure** - Polar handles complex Stripe edge cases
- **Proven patterns** - Service/repository architecture, async SQLAlchemy, Dramatiq tasks
- **Lower risk** - Building on stable foundation vs greenfield project
- **Faster MVP** - Can focus on agent intelligence, not payment plumbing

**Negative**:
- **Legacy patterns we don't need** - Polar has GitHub integration, pledge/campaign models unused by AgentPay
- **Learning curve** - Team needs to understand Polar's architecture before extending
- **Naming overhead** - Polar uses "Product" which overlaps with our agent product lookup
- **Database coupling** - Migrations must maintain Polar schema compatibility

**Mitigation**:
- Document inactive Polar modules in `AGENTPAY_CLEANUP_LOG.md`
- Create clear module boundaries (AgentPay modules don't import Polar internal services)
- Use composition over inheritance when extending Polar models
- Maintain separate ADR documentation for AgentPay-specific decisions

**References**:
- `AGENTPAY_POLAR_ANALYSIS.md` - Full technical comparison
- `AGENTPAY_CLEANUP_LOG.md` - Inactive module documentation

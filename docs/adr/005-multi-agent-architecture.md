# ADR 005: Multi-Agent Architecture (Sales, Support, Payment)

**Status**: Accepted

**Date**: 2025-11-17

**Context**:

Conversational commerce requires handling diverse intents:
- **Sales**: Product discovery, recommendations, cart building
- **Support**: Returns, troubleshooting, account issues
- **Payment**: Checkout, payment methods, order tracking

We evaluated two architectures:

1. **Single Agent**: One agent handles all intents with conditional logic
2. **Multi-Agent**: Specialized agents route by intent

**Single Agent Approach**:
```python
async def handle_message(intent, message, context):
    if intent in [PRODUCT_QUERY, PURCHASE_INTENT]:
        return await handle_sales(message, context)
    elif intent in [RETURN_REQUEST, COMPLAINT]:
        return await handle_support(message, context)
    elif intent in [CHECKOUT_READY, PAYMENT_ISSUE]:
        return await handle_payment(message, context)
```

**Multi-Agent Approach**:
```python
class AgentOrchestrator:
    def __init__(self):
        self.agents = {
            AgentType.SALES: SalesAgent(),
            AgentType.SUPPORT: SupportAgent(),
            AgentType.PAYMENT: PaymentAgent(),
        }

    async def route(self, intent, conversation) -> Agent:
        if intent in SALES_INTENTS:
            return self.agents[AgentType.SALES]
        elif intent in SUPPORT_INTENTS:
            return self.agents[AgentType.SUPPORT]
        # ...
```

**Decision**:

We will implement **Multi-Agent Architecture** with:

1. **Specialized agents**: Sales, Support, Payment (Week 10-12)
2. **Intent-based routing**: Map intent to agent type
3. **Context handoff**: Pass conversation context between agents
4. **Escalation**: Support can escalate to human operators

**Architecture**:

```
┌─────────────────────────────────────────────────┐
│         Agent Orchestrator                       │
│  (Routes by intent, manages handoffs)           │
└───┬─────────────┬─────────────┬─────────────────┘
    │             │             │
┌───▼───────┐ ┌──▼────────┐ ┌──▼─────────┐
│  Sales    │ │  Support  │ │  Payment   │
│  Agent    │ │  Agent    │ │  Agent     │
├───────────┤ ├───────────┤ ├────────────┤
│ Tools:    │ │ Tools:    │ │ Tools:     │
│ -Product  │ │ -Order    │ │ -Checkout  │
│  Lookup   │ │  History  │ │  Link      │
│ -Discount │ │ -Return   │ │ -Payment   │
│  Calc     │ │  Process  │ │  Status    │
└───────────┘ └───────────┘ └────────────┘
```

**Agent Type Definitions**:
```python
class AgentType(StrEnum):
    SALES = "sales"
    SUPPORT = "support"
    PAYMENT = "payment"
    GENERAL = "general"  # Fallback for ambiguous

INTENT_TO_AGENT = {
    # Sales intents
    Intent.PRODUCT_QUERY: AgentType.SALES,
    Intent.RECOMMENDATION_REQUEST: AgentType.SALES,
    Intent.PRICE_NEGOTIATION: AgentType.SALES,
    Intent.PURCHASE_INTENT: AgentType.SALES,

    # Support intents
    Intent.RETURN_REQUEST: AgentType.SUPPORT,
    Intent.COMPLAINT: AgentType.SUPPORT,
    Intent.SIZING_HELP: AgentType.SUPPORT,
    Intent.PRODUCT_QUESTION: AgentType.SUPPORT,

    # Payment intents
    Intent.CHECKOUT_READY: AgentType.PAYMENT,
    Intent.PAYMENT_ISSUE: AgentType.PAYMENT,
    Intent.ORDER_STATUS: AgentType.PAYMENT,

    # General
    Intent.GREETING: AgentType.GENERAL,
    Intent.FAREWELL: AgentType.GENERAL,
}
```

**Context Handoff**:
```python
class ConversationContext:
    """Shared context passed between agents."""
    cart: dict
    customer_profile: dict
    hesitation_signals: int
    previous_agent: AgentType | None
    handoff_reason: str | None

async def handoff(from_agent, to_agent, context):
    """Transfer conversation between agents."""
    # Log handoff
    logger.info(f"Handoff: {from_agent.type} -> {to_agent.type}")

    # Update conversation
    await conversation_service.update_agent(
        conversation_id=context.conversation_id,
        agent_id=to_agent.id,
        metadata={"handoff_from": from_agent.type}
    )

    # Send handoff message
    return {
        "content": f"Let me connect you with our {to_agent.type} specialist...",
        "internal": True
    }
```

**Agent Personalities**:

Each agent type has distinct personality tuning:

**Sales Agent**:
```json
{
  "personality": {
    "tone": "enthusiastic",
    "verbosity": "medium",
    "proactive": true
  },
  "tools": ["product_lookup", "discount_calculator", "similar_products"],
  "rules": {
    "max_discount_percent": 15,
    "upsell_threshold": 5000,
    "cross_sell_enabled": true
  }
}
```

**Support Agent**:
```json
{
  "personality": {
    "tone": "empathetic",
    "verbosity": "high",
    "proactive": false
  },
  "tools": ["order_history", "return_process", "escalate_to_human"],
  "rules": {
    "escalation_threshold": 3,
    "return_window_days": 30
  }
}
```

**Payment Agent**:
```json
{
  "personality": {
    "tone": "professional",
    "verbosity": "low",
    "proactive": false
  },
  "tools": ["checkout_link", "payment_status", "refund_process"],
  "rules": {
    "require_email": true,
    "secure_mode": true
  }
}
```

**Consequences**:

**Positive**:
- **Specialized expertise**: Each agent excels at its domain
- **Cleaner code**: Sales logic separate from support logic
- **Testability**: Test each agent independently
- **Personality tuning**: Sales can be enthusiastic, Support empathetic
- **Tool isolation**: Sales agents don't have refund tools (security)
- **Parallel development**: Teams can work on different agents simultaneously
- **Scalability**: Can add new agent types (Shipping, Returns, VIP) easily

**Negative**:
- **Handoff complexity**: Context must be serialized and passed
- **Intent ambiguity**: Some intents overlap (e.g., "how much does this cost?" - sales or support?)
- **User confusion**: Handoffs may feel disjointed if not smooth
- **Increased latency**: Routing adds 10-20ms overhead
- **State management**: Need to track active agent per conversation

**Routing Strategy**:

```python
class AgentOrchestrator:
    async def route_message(self, message, conversation):
        # 1. Classify intent
        intent = await intent_classifier.classify(message)

        # 2. Determine target agent
        target_agent_type = INTENT_TO_AGENT.get(intent, AgentType.GENERAL)

        # 3. Check if handoff needed
        current_agent_type = conversation.agent.agent_type
        if target_agent_type != current_agent_type:
            await self.handoff(
                from_agent=conversation.agent,
                to_agent=await self.get_agent(target_agent_type),
                context=conversation.context
            )

        # 4. Route to agent
        agent = await self.get_agent(target_agent_type)
        return await agent.handle(message, conversation)
```

**Escalation to Human**:

Support agent can escalate to human operator:
```python
class SupportAgent(BaseAgent):
    async def should_escalate(self, conversation):
        return (
            conversation.hesitation_signals > 5 or
            conversation.sentiment_score < 0.3 or
            "speak to manager" in conversation.last_message.lower()
        )

    async def escalate(self, conversation):
        # Create support ticket
        ticket = await support_service.create_ticket(
            conversation_id=conversation.id,
            priority="high",
            context=conversation.context
        )

        # Notify operator
        await notify_operators(ticket)

        return {
            "content": "I've connected you with our support team. They'll be with you shortly.",
            "escalated": True
        }
```

**Implementation Timeline**:

- **Week 1-3**: Single Sales agent (MVP)
- **Week 10-12**: Multi-agent architecture
- **Week 13+**: Escalation to human operators

**Testing Strategy**:
```python
async def test_agent_routing():
    # Test sales intent routes to sales agent
    result = await orchestrator.route_message(
        message="I'm looking for shoes",
        conversation=sales_conversation
    )
    assert result.agent.agent_type == AgentType.SALES

    # Test handoff from sales to support
    result = await orchestrator.route_message(
        message="I want to return this",
        conversation=sales_conversation
    )
    assert result.agent.agent_type == AgentType.SUPPORT
    assert result.metadata["handoff_from"] == AgentType.SALES
```

**References**:
- `server/polar/agent/enums.py` - AgentType definition
- `server/polar/agent/orchestrator.py` (future implementation)
- OpenAI Assistants API: https://platform.openai.com/docs/assistants/overview

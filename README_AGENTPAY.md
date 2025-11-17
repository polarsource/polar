# AgentPay

**Adaptive Commerce through Conversational AI**

AgentPay is an AI-powered conversational commerce platform built on top of [Polar](https://polar.sh)'s payment infrastructure. It enables merchants to embed intelligent sales agents on their websites that can understand customer needs, recommend products, negotiate pricing, and complete transactions—all through natural conversation.

## What is AgentPay?

AgentPay transforms traditional e-commerce into **adaptive commerce**: instead of forcing customers through rigid product catalogs and checkout flows, AgentPay agents adapt to each customer's unique needs, preferences, and hesitations in real-time.

### Core Capabilities

- **Conversational Product Discovery**: Understand natural language queries ("I need running shoes for trail marathons under $150")
- **Contextual Recommendations**: Leverage RAG-powered knowledge base for semantic product matching
- **Dynamic Pricing**: Negotiate prices based on cart value, hesitation signals, and business rules
- **Seamless Checkout**: Generate secure payment links integrated with Stripe
- **Multi-Agent Orchestration**: Sales, support, and payment agents collaborate to complete transactions
- **Embedded Chat Widget**: Drop-in React component for any website (Astro, Next.js, vanilla)

## How AgentPay Differs from Polar

| **Polar** | **AgentPay** |
|-----------|--------------|
| Payment infrastructure | AI agent layer |
| Product catalog management | Semantic product search (RAG) |
| Checkout API | Conversational checkout |
| Developer-facing APIs | End-customer-facing chat |
| Fixed pricing | Dynamic pricing (within rules) |
| Transactional | Conversational |

**AgentPay builds ON Polar, not replaces it**. We leverage Polar's robust:
- Product models
- Checkout system
- Stripe integration
- Organization/user management
- Webhook infrastructure

And add an intelligent agent layer on top for conversational commerce.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Customer Interface                    │
│  (Embedded Chat Widget - React/Astro/HTML)              │
└───────────────────┬─────────────────────────────────────┘
                    │ WebSocket/HTTP
┌───────────────────▼─────────────────────────────────────┐
│                     Agent Core                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Conversation Understanding (Intent + Entities)│  │
│  │ 2. Context Enrichment (History + Profile)        │  │
│  │ 3. Decision Engine (Action Selection)            │  │
│  │ 4. Tool Invocation (Product Lookup, Checkout)    │  │
│  │ 5. Response Generation (Claude/GPT)              │  │
│  │ 6. State Memory (Conversation Context)           │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼────┐ ┌───▼────┐ ┌───▼────────┐
│ RAG        │ │ Polar  │ │ LLM APIs   │
│ Knowledge  │ │ Checkout│ │ (Claude)   │
│ (pgvector) │ │ Stripe │ │ (OpenAI)   │
└────────────┘ └────────┘ └────────────┘
```

### Key Components

1. **Agent Core** (`server/polar/agent/`)
   - Conversation management
   - Message routing
   - Agent configuration
   - Multi-agent orchestration

2. **Intent Classifier** (`server/polar/agent_conversation/`)
   - Hybrid rule-based + LLM classification
   - Entity extraction (price, color, size, quantity)
   - Context-aware intent detection

3. **Tool System** (`server/polar/agent_tools/`)
   - Product lookup (RAG semantic search)
   - Payment link generation
   - Discount calculation
   - Inventory checking
   - Extensible tool registry

4. **Knowledge Base** (`server/polar/agent_knowledge/`)
   - Product catalog embeddings
   - Semantic search with pgvector
   - Company context (policies, FAQs)
   - Caching layer

5. **Embedded Chat** (`clients/packages/agentpay-chat/`)
   - React chat widget
   - WebSocket real-time communication
   - Responsive UI (Tailwind)
   - Astro integration helpers

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 14+ (with pgvector extension)
- Redis
- Anthropic API key (Claude)
- OpenAI API key (embeddings)

### Backend Setup

```bash
cd server

# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Add required keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
#   STRIPE_SECRET_KEY=sk_test_...

# Start PostgreSQL + Redis
docker compose up -d

# Apply migrations
uv run task db_migrate

# Load sample products
uv run task seeds_load

# Start API server
uv run task api
```

### Frontend Setup (Embedded Chat)

```bash
cd clients

# Install dependencies
pnpm install

# Build chat widget
cd packages/agentpay-chat
pnpm build

# Test in Astro demo site
cd ../../examples/astro-shop
pnpm dev
```

## Embedding AgentPay on Your Site

### Astro Integration

```astro
---
// src/components/Shop.astro
import { AgentPayChat } from '@agentpay/chat';
---

<AgentPayChat
  organizationId="your-org-id"
  agentType="sales"
  position="bottom-right"
/>
```

### React Integration

```tsx
import { AgentPayChat } from '@agentpay/chat';

function App() {
  return (
    <div>
      <YourContent />
      <AgentPayChat
        organizationId="your-org-id"
        agentType="sales"
        onCheckout={(checkoutUrl) => {
          window.location.href = checkoutUrl;
        }}
      />
    </div>
  );
}
```

### Vanilla HTML

```html
<script src="https://cdn.agentpay.com/chat.js"></script>
<script>
  AgentPay.init({
    organizationId: 'your-org-id',
    agentType: 'sales',
    position: 'bottom-right'
  });
</script>
```

## Configuration

### Agent Personality

Configure agent personality in the dashboard or via API:

```json
{
  "personality": {
    "tone": "friendly",
    "verbosity": "medium",
    "emoji_usage": "moderate"
  },
  "tools": {
    "product_lookup": true,
    "payment_link": true,
    "discount_calculator": true
  },
  "rules": {
    "max_discount_percent": 15,
    "allow_dynamic_pricing": true,
    "require_email_for_checkout": true
  }
}
```

### Dynamic Pricing Rules

```json
{
  "dynamic_pricing": {
    "triggers": {
      "hesitation_signals": 3,
      "cart_abandonment_threshold": 300
    },
    "strategies": {
      "cart_value_discount": {
        "min_cart": 10000,
        "discount_percent": 10
      },
      "repeat_customer": {
        "visits_threshold": 3,
        "discount_percent": 5
      }
    }
  }
}
```

## Development Roadmap

### Week 1-3: Foundation (Current)
- ✅ Agent Core models (Agent, Conversation, Message)
- ✅ Service layer (AgentService, ConversationService, MessageService)
- ✅ Intent classifier (hybrid rule-based + LLM)
- ✅ Tool system (registry, product lookup, payment link)
- 🔄 LLM integration (Claude API client)
- 🔄 API endpoints integration

### Week 4-6: RAG Knowledge System
- Product catalog embeddings (OpenAI)
- Semantic search with pgvector
- Company context ingestion
- Caching layer (Redis)

### Week 7-9: Embedded Chat Widget
- React chat component
- WebSocket real-time messaging
- Astro integration
- Mobile-responsive UI

### Week 10-12: Multi-Agent System
- Agent routing (sales/support/payment)
- Context handoff between agents
- Collaborative decision-making
- Escalation logic

## API Reference

### Create Conversation

```bash
POST /v1/agent/conversations
Content-Type: application/json

{
  "session_id": "sess_abc123",
  "organization_id": "org_xyz789"
}
```

### Send Message

```bash
POST /v1/agent/conversations/{id}/messages
Content-Type: application/json

{
  "content": "I'm looking for running shoes under $150",
  "context": {
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://example.com/products"
  }
}
```

Response:
```json
{
  "message": {
    "id": "msg_123",
    "role": "agent",
    "content": "I'd be happy to help you find running shoes! Are you looking for road running or trail running shoes?",
    "intent": "product_query",
    "tool_calls": []
  },
  "conversation": {
    "id": "conv_456",
    "stage": "discovery",
    "context": {
      "budget": 15000,
      "category": "shoes"
    }
  }
}
```

## Testing

```bash
# Backend tests
cd server
uv run task test

# Test intent classifier
uv run pytest tests/agent_conversation/test_intent_classifier.py

# Test tool execution
uv run pytest tests/agent_tools/test_registry.py

# Frontend tests
cd clients/packages/agentpay-chat
pnpm test
```

## Security

- **Authentication**: Organization-scoped agents, customer sessions
- **Rate Limiting**: Per-organization message limits
- **Input Validation**: JSON schema validation on all inputs
- **PII Protection**: No storage of credit card data (handled by Stripe)
- **Prompt Injection Defense**: System prompts isolated from user content

## Performance

- **Intent Classification**: <50ms (rule-based), <500ms (LLM fallback)
- **RAG Retrieval**: <100ms (pgvector cached queries)
- **LLM Response**: 1-3s (streaming enabled)
- **WebSocket Latency**: <100ms (same-region)

## License

AgentPay inherits Polar's Apache 2.0 license. See [LICENSE](LICENSE) for details.

## Contributing

We welcome contributions! Key areas:

- New agent tools (inventory, shipping, reviews)
- Additional LLM providers (Gemini, Llama)
- Enhanced intent patterns
- UI/UX improvements for chat widget
- Documentation and examples

## Support

- **Documentation**: [docs.agentpay.com](https://docs.agentpay.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/flowpay/issues)
- **Discord**: [AgentPay Community](https://discord.gg/agentpay)

## Acknowledgments

Built on the shoulders of:
- **Polar**: Payment infrastructure foundation
- **Anthropic Claude**: Conversational AI
- **OpenAI**: Embeddings and fallback LLM
- **FastAPI**: High-performance async Python API
- **PostgreSQL + pgvector**: Vector database for RAG

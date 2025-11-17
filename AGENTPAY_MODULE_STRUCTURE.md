# AgentPay Module Structure

**Strategy:** Build NEW modules for AgentPay alongside Polar's existing modules

## New Modules to Create

### Week 1-2: Foundation
```
/server/polar/agent/               # Agent Core
├── __init__.py
├── service.py                     # Main orchestration
├── endpoints.py                   # API routes
├── repository.py                  # Data access
├── schemas.py                     # Pydantic models
├── auth.py                        # Agent-specific auth
└── enums.py                       # Intent, Action enums

/server/polar/models/
├── agent.py                       # NEW: Agent configuration
├── conversation.py                # NEW: Conversation state
├── message.py                     # NEW: Chat messages
└── conversation_checkpoint.py     # NEW: Conversation snapshots
```

### Week 3-4: Intelligence
```
/server/polar/agent_conversation/  # Conversation management
├── __init__.py
├── service.py                     # Conversation CRUD
├── state_manager.py               # Redis state sync
├── message_handler.py             # Message processing
└── intent_classifier.py           # Hybrid intent detection

/server/polar/agent_knowledge/     # RAG system
├── __init__.py
├── service.py                     # Knowledge retrieval
├── embedding_service.py           # Generate embeddings
├── vector_store.py                # pgvector/Pinecone wrapper
└── tasks.py                       # Background indexing jobs
```

### Week 5-6: Tools & Actions
```
/server/polar/agent_tools/         # Tool registry
├── __init__.py
├── base.py                        # BaseTool abstract class
├── product_lookup.py              # RAG product search
├── payment_link.py                # Generate checkout links
├── shipping_calculator.py         # Shipping quotes
├── discount_validator.py          # Validate coupons
├── inventory_checker.py           # Stock validation
└── registry.py                    # Tool registration
```

### Week 7-8: Multi-Agent
```
/server/polar/multi_agent/         # Multi-agent orchestration
├── __init__.py
├── orchestrator.py                # Route to sub-agents
├── sales_agent.py                 # Sales specialist
├── support_agent.py               # Support specialist
├── payment_agent.py               # Payment specialist
└── context_store.py               # Shared context (Redis)
```

## Extended Modules (Modify Existing)

### Extend Checkout
```
/server/polar/checkout/
├── service.py                     # ADD: conversational checkout methods
└── schemas.py                     # ADD: ConversationCheckout schema

/server/polar/models/
└── checkout.py                    # ADD: conversation_id, commitment_level, agent_context fields
```

### Extend Product
```
/server/polar/product/
├── service.py                     # ADD: RAG indexing trigger
└── schemas.py                     # ADD: conversational metadata

/server/polar/models/
└── product.py                     # ADD: conversational_description, voice_description, etc.
```

### Extend Customer
```
/server/polar/customer/
├── service.py                     # ADD: conversation history access
└── schemas.py                     # ADD: communication channel fields

/server/polar/models/
└── customer.py                    # ADD: phone_number, whatsapp_id, preferred_channel
```

## API Routes

### New Endpoints
```
/v1/agent/conversations            # POST: Create conversation
/v1/agent/conversations/{id}       # GET: Get conversation
/v1/agent/conversations/{id}/messages  # POST: Send message, GET: History
/v1/agent/conversations/ws         # WebSocket: Real-time chat
/v1/agent/tools                    # GET: Available tools
/v1/agent/knowledge/search         # POST: RAG search
```

### Extended Endpoints
```
/v1/checkouts                      # EXTEND: Support conversational checkouts
/v1/products                       # EXTEND: Include RAG metadata
/v1/customers                      # EXTEND: Include conversation history
```

## Database Migrations

### Phase 1: Agent Core (Week 2)
```sql
-- agents table
CREATE TABLE agents (...);

-- conversations table
CREATE TABLE conversations (...);

-- messages table
CREATE TABLE messages (...);
```

### Phase 2: Extensions (Week 3)
```sql
-- Extend products
ALTER TABLE products ADD COLUMN conversational_description TEXT;
ALTER TABLE products ADD COLUMN voice_description VARCHAR(500);

-- Extend customers
ALTER TABLE customers ADD COLUMN phone_number VARCHAR(50);
ALTER TABLE customers ADD COLUMN whatsapp_id VARCHAR(100);

-- Extend checkouts
ALTER TABLE checkouts ADD COLUMN conversation_id UUID;
ALTER TABLE checkouts ADD COLUMN commitment_level VARCHAR(50);
```

### Phase 3: Knowledge Base (Week 4)
```sql
-- Product embeddings
CREATE TABLE product_embeddings (...);

-- Knowledge articles
CREATE TABLE knowledge_articles (...);
```

## Implementation Order

**Priority 1 (Week 1-2):**
1. Create Agent Core models
2. Basic conversation API
3. Intent classification

**Priority 2 (Week 3-4):**
4. RAG system
5. Product search
6. Tool registry

**Priority 3 (Week 5-6):**
7. Conversational checkout
8. Dynamic pricing
9. Multi-agent orchestration

**Priority 4 (Week 7-8):**
10. Payment integration
11. Webhook handlers
12. Background jobs

---

**Next Step:** Create first migration for Agent Core models

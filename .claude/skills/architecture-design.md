# Architecture & System Design Skill

## Purpose
Guide the overall system architecture for AgentPay, ensuring scalability, reliability, and maintainability while building on Polar's foundation.

## Core Architecture Vision

AgentPay extends Polar with four new layers:

```
┌─────────────────────────────────────────────────────────┐
│          CONVERSATIONAL INTERFACE LAYER                 │
│  WhatsApp | Slack | Telegram | Web Chat | AI Agents    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          INTENT UNDERSTANDING ENGINE                    │
│  NLU · Context Management · Entity Extraction           │
│  LLM Integration · Confidence Scoring                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          PAYMENT ORCHESTRATION LAYER                    │
│  Rail Selection · Cost Optimization · Routing           │
│  PIX · PayTo · Stripe · Wise · SEPA · USDC             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          TRUST & TRANSPARENCY LAYER                     │
│  Explainability · KYC/AML · Fraud Detection            │
│  Compliance · Audit Logging                             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          CONTEXT & MEMORY LAYER                         │
│  Reconciliation · Accounting Sync · Relationship Graph  │
│  QuickBooks · Xero · Conta Azul                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          POLAR FOUNDATION                               │
│  Auth · Database · File Storage · Background Jobs       │
│  PostgreSQL · Redis · S3 · Dramatiq                     │
└─────────────────────────────────────────────────────────┘
```

## System Architecture Principles

### 1. Modularity
- Each layer is independently deployable
- Clear interfaces between layers
- Follow Polar's modular structure (service/repository pattern)

### 2. Resilience
- Graceful degradation if components fail
- Retry logic with exponential backoff
- Circuit breakers for external services
- Fallback options for critical paths

### 3. Observability
- Structured logging at every layer
- Distributed tracing (OpenTelemetry)
- Real-time metrics (Prometheus)
- Error tracking (Sentry)

### 4. Scalability
- Horizontal scaling for API servers
- Queue-based async processing
- Database read replicas
- Caching strategy (Redis)

### 5. Security
- End-to-end encryption for sensitive data
- API key rotation
- Rate limiting per user/conversation
- PCI DSS compliance for payment data

## Detailed Component Design

### 1. Conversational Interface Layer

**Message Router Service**
```python
# server/polar/messaging/router.py

class MessageRouter:
    """Route messages from platforms to intent engine"""

    async def route_message(
        self,
        message: IncomingMessage,
        platform: Platform
    ) -> ConversationContext:
        """
        1. Authenticate message source
        2. Load conversation context
        3. Forward to intent engine
        4. Return response via appropriate platform adapter
        """
```

**Platform Adapters**
```
server/polar/messaging/
├── adapters/
│   ├── base.py              # Abstract adapter
│   ├── whatsapp.py          # WhatsApp Business API
│   ├── slack.py             # Slack Events API
│   ├── telegram.py          # Telegram Bot API
│   ├── webchat.py           # Custom web widget
│   └── ai_agent.py          # API for AI agents (ChatGPT, Claude)
```

Each adapter implements:
```python
class PlatformAdapter(ABC):
    @abstractmethod
    async def send_message(self, conversation_id: str, message: str) -> None:
        """Send message to platform"""

    @abstractmethod
    async def send_payment_link(self, conversation_id: str, link: PaymentLink) -> None:
        """Send interactive payment element"""

    @abstractmethod
    async def send_rich_card(self, conversation_id: str, card: RichCard) -> None:
        """Send structured response (carousel, buttons, etc.)"""
```

### 2. Intent Understanding Engine

**Architecture**
```
server/polar/intent_recognition/
├── service.py                    # Main orchestrator
├── classifiers/
│   ├── rule_based.py            # Fast, deterministic rules
│   ├── llm_classifier.py        # LLM-based classification
│   └── hybrid_classifier.py     # Route to appropriate classifier
├── extractors/
│   ├── amount_extractor.py
│   ├── date_extractor.py
│   ├── currency_extractor.py
│   └── recipient_extractor.py
├── context/
│   ├── conversation_store.py    # Persist conversation state
│   ├── entity_resolver.py       # Resolve entities across turns
│   └── memory_manager.py        # Short-term & long-term memory
└── cache/
    └── intent_cache.py          # Cache common patterns
```

**Decision Flow**
```python
async def process_message(message: str, context: ConversationContext) -> IntentResult:
    # 1. Check cache for exact/similar patterns
    cached = await intent_cache.get(message)
    if cached and cached.confidence > 0.95:
        return cached

    # 2. Try rule-based classification (fast path)
    rule_result = rule_based_classifier.classify(message)
    if rule_result.confidence > 0.9:
        return rule_result

    # 3. Use LLM for ambiguous cases (slow but accurate)
    llm_result = await llm_classifier.classify(message, context)

    # 4. Cache result
    await intent_cache.set(message, llm_result)

    return llm_result
```

### 3. Payment Orchestration Layer

**Core Components**
```
server/polar/payment_orchestration/
├── service.py                   # Main orchestration logic
├── repository.py                # Payment persistence
├── routing/
│   ├── cost_calculator.py      # Calculate cost per rail
│   ├── rail_selector.py        # Select optimal rail
│   ├── compliance_checker.py   # Check KYC/AML requirements
│   └── fallback_manager.py     # Handle failures
├── rails/
│   ├── base.py                 # Abstract adapter
│   ├── pix/
│   │   ├── client.py           # PIX API client
│   │   ├── adapter.py          # PaymentRailAdapter implementation
│   │   └── webhook_handler.py  # Handle PIX webhooks
│   ├── payto/                  # Similar structure
│   ├── stripe/
│   ├── wise/
│   └── sepa/
└── monitoring/
    └── rail_health.py          # Monitor rail availability
```

**Orchestration Logic**
```python
async def orchestrate_payment(
    request: PaymentRequest,
    context: ConversationContext
) -> OrchestrationResult:
    """
    1. Validate request
    2. Get available rails for this transaction
    3. Calculate cost for each rail
    4. Apply user preferences & business rules
    5. Select optimal rail
    6. Initiate payment
    7. Set up monitoring & fallback
    8. Return result with explanation
    """

    # Get available rails
    available_rails = await get_available_rails(request)

    # Score each rail
    scored_rails = []
    for rail in available_rails:
        score = await calculate_rail_score(
            rail=rail,
            request=request,
            user_preferences=context.user_preferences
        )
        scored_rails.append((rail, score))

    # Select best rail
    selected_rail = max(scored_rails, key=lambda x: x[1])[0]

    # Initiate payment
    payment_result = await selected_rail.initiate_payment(request)

    # Generate explanation
    explanation = generate_explanation(selected_rail, scored_rails, payment_result)

    return OrchestrationResult(
        payment_id=payment_result.id,
        rail=selected_rail.name,
        explanation=explanation,
        estimated_completion=payment_result.estimated_completion,
        cost=payment_result.cost
    )
```

### 4. Trust & Transparency Layer

**Components**
```
server/polar/trust/
├── explainer.py                 # Generate human explanations
├── compliance/
│   ├── kyc_service.py          # Know Your Customer
│   ├── aml_service.py          # Anti-Money Laundering
│   ├── sanctions_checker.py    # Sanctions screening
│   └── limit_enforcer.py       # Transaction limits
├── fraud/
│   ├── detector.py             # Fraud detection
│   ├── risk_scorer.py          # Risk scoring
│   └── rules_engine.py         # Fraud rules
└── audit/
    ├── audit_logger.py         # Audit trail
    └── compliance_reporter.py  # Generate compliance reports
```

**Explainability Engine**
```python
def generate_explanation(
    selected_rail: PaymentRail,
    all_options: list[tuple[PaymentRail, Score]],
    result: PaymentResult
) -> Explanation:
    """
    Generate human-readable explanation:

    "You're paying via PIX (Brazil's instant payment system).
    ✓ Funds arrive in seconds
    ✓ Fee: R$ 2.40 (0.4%)
    ✓ Best option: 60% cheaper than Stripe, 3x faster than bank transfer"
    """

    explanation = Explanation(
        primary_message=f"You're paying via {selected_rail.display_name}",
        benefits=[
            f"Funds arrive {result.estimated_completion}",
            f"Fee: {format_fee(result.cost)}",
        ],
        comparison=generate_comparison(selected_rail, all_options),
        confidence_level=calculate_confidence(result)
    )

    return explanation
```

### 5. Context & Memory Layer

**Components**
```
server/polar/context_memory/
├── reconciliation/
│   ├── service.py              # Match payments to conversations
│   ├── auto_categorizer.py     # Categorize transactions
│   └── duplicate_detector.py   # Detect duplicate payments
├── accounting_sync/
│   ├── adapters/
│   │   ├── quickbooks.py
│   │   ├── xero.py
│   │   └── conta_azul.py
│   └── sync_service.py
├── relationship_graph/
│   ├── graph_builder.py        # Build payment relationship graph
│   ├── pattern_detector.py     # Detect payment patterns
│   └── insights_generator.py   # Generate insights
└── memory/
    ├── conversation_memory.py  # Track conversation history
    └── user_preferences.py     # Learn user preferences
```

**Relationship Graph**
```python
class PaymentRelationshipGraph:
    """
    Track relationships:
    - Who pays whom
    - Typical amounts
    - Payment patterns
    - Conversation → Payment mapping
    """

    async def build_graph(self, user_id: UUID) -> Graph:
        """Build payment relationship graph for user"""

    async def detect_patterns(self, user_id: UUID) -> list[Pattern]:
        """
        Detect patterns like:
        - Recurring payments (rent, subscriptions)
        - Split payment groups (friends, team)
        - Business vs personal classification
        """

    async def predict_next_action(
        self,
        conversation: Conversation
    ) -> PredictedAction:
        """
        Predict likely next action based on history:
        - "User typically pays Client A within 24h"
        - "This looks like a recurring monthly invoice"
        """
```

## Database Schema Design

### Core Tables

```sql
-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    external_conversation_id VARCHAR(255) UNIQUE,
    participants JSONB NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP,
    INDEX idx_external_conv (platform, external_conversation_id)
);

-- Messages
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id),
    sender_id VARCHAR(255),
    message_text TEXT,
    detected_intent VARCHAR(50),
    extracted_entities JSONB,
    confidence_score FLOAT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_conversation (conversation_id, created_at)
);

-- Orchestration Payments
CREATE TABLE orchestration_payments (
    id UUID PRIMARY KEY,
    conversation_message_id UUID REFERENCES conversation_messages(id),
    amount DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    from_country VARCHAR(2),
    to_country VARCHAR(2),
    selected_rail VARCHAR(50) NOT NULL,
    alternative_rails JSONB,
    cost_breakdown JSONB,
    status VARCHAR(50) NOT NULL,
    explanation TEXT,
    external_payment_id VARCHAR(255),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_status (status, created_at),
    INDEX idx_conversation (conversation_message_id)
);

-- Payment Rails Status
CREATE TABLE payment_rail_status (
    id UUID PRIMARY KEY,
    rail_name VARCHAR(50) UNIQUE NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    last_check_at TIMESTAMP,
    error_rate_1h FLOAT,
    avg_latency_ms INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Relationship Graph
CREATE TABLE payment_relationships (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    counterparty_id VARCHAR(255),
    total_payments_count INTEGER DEFAULT 0,
    total_amount DECIMAL(19, 4),
    currency VARCHAR(3),
    avg_payment_amount DECIMAL(19, 4),
    typical_rails JSONB,
    last_payment_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, counterparty_id)
);
```

## API Design

### RESTful Endpoints

```python
# Messaging webhooks
POST /api/v1/webhooks/whatsapp
POST /api/v1/webhooks/slack
POST /api/v1/webhooks/telegram

# Intent API
POST /api/v1/intent/analyze
GET  /api/v1/conversations/{id}/intents

# Payment Orchestration
POST /api/v1/payments/orchestrate
GET  /api/v1/payments/{id}
GET  /api/v1/payments/{id}/alternatives
POST /api/v1/payments/{id}/fallback

# Rails Management
GET  /api/v1/rails
GET  /api/v1/rails/{rail_name}/capabilities
GET  /api/v1/rails/{rail_name}/status

# User Preferences
GET  /api/v1/users/{id}/preferences
PUT  /api/v1/users/{id}/preferences

# Analytics & Insights
GET  /api/v1/users/{id}/payment-patterns
GET  /api/v1/users/{id}/relationship-graph
```

### WebSocket for Real-time Updates

```python
WS /api/v1/conversations/{id}/stream

# Events:
{
    "type": "intent_detected",
    "data": {"intent": "payment_promise", "confidence": 0.95}
}

{
    "type": "payment_initiated",
    "data": {"payment_id": "...", "rail": "pix"}
}

{
    "type": "payment_completed",
    "data": {"payment_id": "...", "status": "success"}
}
```

## Deployment Architecture

### Infrastructure

```
┌─────────────────────────────────────────┐
│          Load Balancer (NGINX)          │
└─────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼──────────┐
│  API Servers   │  │  API Servers    │
│  (FastAPI)     │  │  (FastAPI)      │
│  - Auth        │  │  - Auth         │
│  - Intent      │  │  - Intent       │
│  - Orchestrate │  │  - Orchestrate  │
└───────┬────────┘  └──────┬──────────┘
        │                   │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  PostgreSQL       │
        │  (Primary + Read  │
        │   Replicas)       │
        └───────────────────┘

┌─────────────────────────────────────────┐
│          Redis Cluster                  │
│  - Session cache                        │
│  - Intent cache                         │
│  - Rate limiting                        │
│  - Dramatiq queue                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Background Workers             │
│  (Dramatiq)                             │
│  - Payment processing                   │
│  - Webhook handling                     │
│  - Reconciliation                       │
│  - Analytics                            │
└─────────────────────────────────────────┘
```

### Scalability Considerations

1. **API Servers**: Horizontal scaling behind load balancer
2. **Workers**: Scale independently based on queue depth
3. **Database**:
   - Read replicas for analytics queries
   - Connection pooling
   - Partitioning for large tables (by time)
4. **Caching**:
   - Redis cluster for high availability
   - Cache warming for common patterns
5. **Rate Limiting**:
   - Per user: 100 req/min
   - Per conversation: 10 req/min
   - Per IP: 1000 req/min

## Monitoring & Observability

### Key Metrics

```python
# Prometheus metrics
intent_classification_latency = Histogram('intent_classification_latency_seconds')
intent_classification_accuracy = Gauge('intent_classification_accuracy')
payment_orchestration_latency = Histogram('payment_orchestration_latency_seconds')
payment_success_rate = Gauge('payment_success_rate', ['rail'])
rail_availability = Gauge('rail_availability', ['rail_name'])
conversation_active_count = Gauge('conversation_active_count')
```

### Logging Strategy

```python
import structlog

logger = structlog.get_logger()

# Every log includes:
logger.info(
    "payment_orchestrated",
    conversation_id=conversation.id,
    payment_id=payment.id,
    selected_rail=rail.name,
    amount=payment.amount,
    currency=payment.currency,
    latency_ms=latency,
    cost_usd=cost
)
```

### Distributed Tracing

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("orchestrate_payment") as span:
    span.set_attribute("conversation.id", conversation_id)
    span.set_attribute("payment.amount", amount)

    # Child spans for each step
    with tracer.start_as_current_span("select_rail"):
        rail = await select_rail(...)

    with tracer.start_as_current_span("initiate_payment"):
        result = await rail.initiate_payment(...)
```

## Security Architecture

### API Security
- JWT authentication (extend Polar's auth)
- API key for external integrations
- Rate limiting per client
- Request signing for webhooks

### Data Security
- Encrypt sensitive data at rest (PII, payment details)
- TLS for all communications
- PCI DSS compliance for card data
- GDPR compliance for EU users

### Secrets Management
- Use AWS Secrets Manager or HashiCorp Vault
- Rotate API keys regularly
- Never log sensitive data

## Success Criteria

### Performance
- API latency p95 < 500ms
- Intent classification < 300ms
- Payment orchestration < 1s
- 99.9% uptime

### Scale
- Support 10,000 concurrent conversations
- Process 100 payments/second
- Handle 1M messages/day

### Quality
- Intent accuracy > 95%
- Payment success rate > 99%
- Zero data loss
- < 0.1% fraud rate

## Related Skills
All other skills build on this architecture foundation.

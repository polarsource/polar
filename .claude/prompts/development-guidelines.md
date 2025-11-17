# AgentPay Development Guidelines

## Project Structure

AgentPay is built as an extension to the Polar platform, following Polar's architectural patterns while adding new capabilities for conversational, AI-native payments.

### Directory Organization

```
server/polar/
├── messaging/                    # NEW: Messaging platform integrations
│   ├── router.py                # Route messages to intent engine
│   ├── adapters/                # Platform-specific adapters
│   │   ├── whatsapp.py
│   │   ├── slack.py
│   │   └── telegram.py
│   └── schemas.py
│
├── intent_recognition/          # NEW: Intent detection & NLU
│   ├── service.py              # Main intent service
│   ├── classifiers/            # Intent classification
│   ├── extractors/             # Entity extraction
│   ├── context/                # Conversation context
│   └── schemas.py
│
├── payment_orchestration/       # NEW: Multi-rail payment routing
│   ├── service.py              # Orchestration logic
│   ├── routing/                # Rail selection
│   ├── rails/                  # Payment rail adapters
│   │   ├── pix/
│   │   ├── payto/
│   │   ├── wise/
│   │   └── sepa/
│   └── schemas.py
│
├── conversational_payments/     # NEW: Conversational flows
│   ├── service.py
│   ├── flows/                  # Payment flows
│   ├── confirmation/           # User confirmations
│   ├── rendering/              # Message rendering
│   └── schemas.py
│
├── trust/                       # NEW: Trust & compliance
│   ├── explainer.py
│   ├── compliance/             # KYC/AML
│   ├── fraud/                  # Fraud detection
│   └── audit/                  # Audit logging
│
├── context_memory/              # NEW: Context & memory
│   ├── reconciliation/
│   ├── accounting_sync/
│   ├── relationship_graph/
│   └── memory/
│
└── integrations/                # Polar's existing integrations
    └── stripe/                  # We'll wrap and extend
```

## Coding Standards

### Follow Polar's Patterns

1. **Service/Repository Pattern**
   ```python
   # repository.py - Data access
   class PaymentOrchestrationRepository:
       async def create(
           self,
           session: AsyncSession,
           payment: OrchestrationPayment
       ) -> OrchestrationPayment:
           session.add(payment)
           await session.flush()  # NOT commit!
           return payment

   # service.py - Business logic
   class PaymentOrchestrationService:
       async def orchestrate_payment(
           self,
           session: AsyncSession,
           request: PaymentRequest
       ) -> OrchestrationResult:
           # Business logic here
           payment = await self.repository.create(session, payment_entity)
           return result
   ```

2. **Never Call session.commit() Directly**
   - API backend auto-commits at end of request
   - Background workers auto-commit at end of task
   - Use `session.flush()` if you need to ensure data is written
   - Document if you truly need an exception

3. **Async/Await Everywhere**
   ```python
   # Good
   async def process_message(
       self,
       session: AsyncSession,
       message: str
   ) -> IntentResult:
       intent = await self.classify_intent(message)
       return intent

   # Bad - blocking I/O
   def process_message(self, message: str):
       response = requests.post(...)  # Blocks event loop!
   ```

4. **Dependency Injection**
   ```python
   # endpoints.py
   @router.post("/intent/analyze")
   async def analyze_intent(
       message: IntentAnalysisRequest,
       intent_service: IntentService = Depends(),
       session: AsyncSession = Depends(get_db_session)
   ) -> IntentResult:
       return await intent_service.analyze(session, message.text)
   ```

### Type Hints

Use proper type hints everywhere:

```python
from typing import Optional
from decimal import Decimal
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Mapped

# Function signatures
async def create_payment(
    amount: Decimal,
    currency: str,
    due_date: Optional[datetime] = None
) -> OrchestrationPayment:
    ...

# SQLAlchemy models
class OrchestrationPayment(Base):
    id: Mapped[UUID]
    amount: Mapped[Decimal]
    currency: Mapped[str]
    completed_at: Mapped[datetime | None]
```

### Error Handling

Use custom exceptions with HTTP status codes:

```python
# exceptions.py
class PaymentOrchestrationException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "orchestration_error"
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)

class NoAvailableRailException(PaymentOrchestrationException):
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=503,
            error_code="no_available_rail"
        )

# Usage
async def select_rail(request: PaymentRequest) -> PaymentRail:
    available_rails = await self.get_available_rails(request)

    if not available_rails:
        raise NoAvailableRailException(
            f"No payment rails available for {request.currency}"
        )

    return available_rails[0]
```

### Logging

Use structured logging:

```python
import structlog

logger = structlog.get_logger(__name__)

# Good - structured
logger.info(
    "payment_orchestrated",
    payment_id=str(payment.id),
    amount=float(payment.amount),
    currency=payment.currency,
    rail=payment.selected_rail,
    latency_ms=latency
)

# Bad - unstructured string
logger.info(f"Payment {payment.id} orchestrated via {payment.rail}")
```

### Configuration

Use Pydantic settings (following Polar's pattern):

```python
from pydantic_settings import BaseSettings

class PaymentOrchestrationSettings(BaseSettings):
    pix_api_key: str
    pix_sandbox: bool = True
    wise_api_key: str
    default_timeout_seconds: int = 300

    class Config:
        env_prefix = "AGENTPAY_"

settings = PaymentOrchestrationSettings()
```

## Database Design

### Naming Conventions

- Table names: snake_case, plural (e.g., `orchestration_payments`)
- Column names: snake_case (e.g., `external_payment_id`)
- Foreign keys: `{table}_id` (e.g., `conversation_id`)
- Indexes: `idx_{table}_{column(s)}` (e.g., `idx_payments_status`)

### Migrations

Use Alembic (Polar's migration tool):

```bash
# Generate migration
cd server
uv run alembic revision --autogenerate -m "Add orchestration_payments table"

# Review the generated migration file
# Edit if needed (Alembic doesn't catch everything)

# Apply migration
uv run task db_migrate
```

### Model Example

```python
from sqlalchemy import String, DateTime, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column
from polar.kit.db.models import RecordModel

class OrchestrationPayment(RecordModel):
    __tablename__ = "orchestration_payments"

    # Use Mapped[type] for type hints
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Optional fields use | None
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # JSON fields
    cost_breakdown: Mapped[dict] = mapped_column(JSON, nullable=False)
    alternative_rails: Mapped[list[str]] = mapped_column(JSON, nullable=False)

    # Indexes
    __table_args__ = (
        Index("idx_orchestration_payments_status", "status", "created_at"),
        Index("idx_orchestration_payments_conversation", "conversation_message_id"),
    )
```

## Testing Standards

### Test Organization

Follow Polar's pattern - class-based test organization:

```python
import pytest
from decimal import Decimal

class TestPaymentOrchestration:
    """Tests for payment orchestration service"""

    async def test_select_pix_for_brazil_domestic(
        self,
        session: AsyncSession,
        payment_orchestration_service: PaymentOrchestrationService
    ):
        """PIX should be selected for BRL → BRL in Brazil"""

        request = PaymentRequest(
            amount=Decimal("100"),
            currency="BRL",
            from_country="BR",
            to_country="BR"
        )

        result = await payment_orchestration_service.orchestrate_payment(
            session,
            request
        )

        assert result.selected_rail == "pix"
        assert result.cost.fee < Decimal("1")  # Low fee

    async def test_fallback_on_rail_failure(
        self,
        session: AsyncSession,
        payment_orchestration_service: PaymentOrchestrationService,
        mock_failing_rail: Mock
    ):
        """Should retry with alternative rail on failure"""

        # Test implementation
        ...
```

### Fixtures

Create reusable fixtures:

```python
# conftest.py

@pytest.fixture
async def conversation_context() -> ConversationContext:
    return ConversationContext(
        conversation_id=uuid4(),
        platform=Platform.WHATSAPP,
        participants=["user_123"],
        intent_history=[],
        extracted_entities={},
        language="en"
    )

@pytest.fixture
def mock_pix_client(monkeypatch):
    """Mock PIX client for testing"""
    from tests.mocks.pix_mock import MockPIXClient

    client = MockPIXClient()
    return client
```

### Test Coverage

Aim for:
- Unit tests: > 80% coverage
- Integration tests: Critical paths
- E2E tests: Happy path + key error scenarios

```bash
# Run tests with coverage
cd server
uv run task test

# Fast tests (parallel, no coverage)
uv run task test_fast
```

## API Design

### Endpoint Patterns

Follow REST conventions:

```python
# Collection operations
GET    /api/v1/payments             # List payments
POST   /api/v1/payments             # Create payment

# Resource operations
GET    /api/v1/payments/{id}        # Get payment
PATCH  /api/v1/payments/{id}        # Update payment
DELETE /api/v1/payments/{id}        # Cancel payment

# Sub-resources
GET    /api/v1/payments/{id}/alternatives  # Get alternative rails
POST   /api/v1/payments/{id}/fallback      # Trigger fallback

# Actions (non-CRUD)
POST   /api/v1/intent/analyze               # Analyze intent
POST   /api/v1/webhooks/whatsapp            # Webhook receiver
```

### Request/Response Models

Use Pydantic schemas:

```python
# schemas.py

from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime

class PaymentRequest(BaseModel):
    amount: Decimal = Field(gt=0, description="Payment amount")
    currency: str = Field(min_length=3, max_length=3, description="ISO currency code")
    description: str | None = None

class PaymentResponse(BaseModel):
    payment_id: str
    status: str
    payment_url: str | None
    qr_code: str | None
    estimated_completion: int  # seconds

    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "pending",
                "payment_url": None,
                "qr_code": "data:image/png;base64,...",
                "estimated_completion": 5
            }
        }
```

### Authentication

Use Polar's auth system:

```python
from polar.auth.dependencies import WebUser

@router.post("/payments")
async def create_payment(
    request: PaymentRequest,
    auth_subject: WebUser = Depends()  # Require authenticated user
) -> PaymentResponse:
    user = auth_subject.subject  # Get User object
    ...
```

## Background Jobs

Use Dramatiq (Polar's task queue):

```python
# tasks.py

import dramatiq
from polar.worker import WorkerSettings

@dramatiq.actor(
    max_retries=3,
    time_limit=60_000,  # 60 seconds
    priority=0
)
async def process_payment_webhook(payment_id: str) -> None:
    """Process payment webhook asynchronously"""

    async with AsyncSession() as session:
        payment = await payment_repository.get(session, payment_id)

        # Process webhook
        ...

        # Session auto-commits at end of task

# Usage
await process_payment_webhook.send(payment_id=str(payment.id))
```

## Documentation

### Code Comments

Keep minimal - code should be self-documenting:

```python
# Good - comment explains WHY, not WHAT
async def calculate_rail_score(rail: PaymentRail, request: PaymentRequest) -> float:
    # We weight cost 2x higher than speed for cross-border payments
    # based on user research showing cost sensitivity
    cost_weight = 2.0 if request.is_cross_border else 1.0
    ...

# Bad - comment repeats code
async def get_payment(payment_id: str) -> Payment:
    # Get payment by ID
    return await self.repository.get(payment_id)
```

### Docstrings

Use for public APIs and complex logic:

```python
async def orchestrate_payment(
    self,
    session: AsyncSession,
    request: PaymentRequest
) -> OrchestrationResult:
    """
    Orchestrate payment across available rails.

    Selects optimal payment rail based on:
    - Cost efficiency (fees + FX rates)
    - Settlement speed
    - Compliance requirements
    - User preferences

    Args:
        session: Database session
        request: Payment request with amount, currency, etc.

    Returns:
        OrchestrationResult with selected rail and explanation

    Raises:
        NoAvailableRailException: If no rails support this payment
        ComplianceException: If payment fails compliance checks
    """
```

## Performance Guidelines

### Database Queries

- Use `select()` with `options()` for efficient loading
- Avoid N+1 queries with `selectinload()` or `joinedload()`
- Use indexes for frequently queried columns
- Paginate large result sets

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Good - eager load relationships
stmt = (
    select(OrchestrationPayment)
    .options(selectinload(OrchestrationPayment.conversation))
    .where(OrchestrationPayment.status == "pending")
    .limit(100)
)
payments = await session.execute(stmt)

# Bad - N+1 query
payments = await session.execute(
    select(OrchestrationPayment).where(status="pending")
)
for payment in payments:
    conversation = await session.get(Conversation, payment.conversation_id)  # N queries!
```

### Caching

Use Redis for caching:

```python
from polar.redis import Redis

class IntentCacheService:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def get_cached_intent(self, message: str) -> IntentResult | None:
        """Get cached intent for exact message match"""

        key = f"intent:{hashlib.sha256(message.encode()).hexdigest()}"
        cached = await self.redis.get(key)

        if cached:
            return IntentResult.parse_raw(cached)
        return None

    async def cache_intent(
        self,
        message: str,
        result: IntentResult,
        ttl: int = 3600
    ) -> None:
        """Cache intent result for 1 hour"""

        key = f"intent:{hashlib.sha256(message.encode()).hexdigest()}"
        await self.redis.setex(key, ttl, result.json())
```

### External API Calls

- Use connection pooling
- Set reasonable timeouts
- Implement retry logic with exponential backoff
- Cache responses when appropriate

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class ExternalAPIClient:
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=100)
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def make_request(self, url: str) -> dict:
        """Make request with retry logic"""

        response = await self.client.post(url)
        response.raise_for_status()
        return response.json()
```

## Security Best Practices

1. **Never log sensitive data**
   ```python
   # Bad
   logger.info(f"Processing payment with card {card_number}")

   # Good
   logger.info("processing_payment", payment_id=payment_id)
   ```

2. **Encrypt sensitive fields in database**
   ```python
   from polar.kit.crypto import encrypt, decrypt

   payment.card_number = encrypt(card_number)
   ```

3. **Validate all inputs**
   ```python
   class PaymentRequest(BaseModel):
       amount: Decimal = Field(gt=0, le=1_000_000)
       currency: str = Field(pattern="^[A-Z]{3}$")
   ```

4. **Rate limit API endpoints**
   ```python
   from slowapi import Limiter

   @router.post("/payments")
   @limiter.limit("10/minute")
   async def create_payment(...):
       ...
   ```

## Monitoring & Observability

### Metrics

Use Prometheus metrics:

```python
from prometheus_client import Counter, Histogram, Gauge

payment_orchestrated = Counter(
    "agentpay_payments_orchestrated_total",
    "Total payments orchestrated",
    ["rail", "currency"]
)

orchestration_latency = Histogram(
    "agentpay_orchestration_latency_seconds",
    "Payment orchestration latency"
)

# Usage
with orchestration_latency.time():
    result = await self.orchestrate_payment(session, request)

payment_orchestrated.labels(
    rail=result.selected_rail,
    currency=request.currency
).inc()
```

### Distributed Tracing

Use OpenTelemetry:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

async def orchestrate_payment(self, session, request):
    with tracer.start_as_current_span(
        "orchestrate_payment",
        attributes={
            "payment.amount": float(request.amount),
            "payment.currency": request.currency
        }
    ) as span:
        # ... implementation ...

        span.set_attribute("payment.selected_rail", result.rail)
        return result
```

## Deployment Checklist

Before deploying:

- [ ] All tests passing
- [ ] Database migrations tested
- [ ] Environment variables documented
- [ ] Error monitoring configured (Sentry)
- [ ] Metrics dashboard created
- [ ] Rollback plan documented
- [ ] Feature flags configured
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated

## Getting Help

- Review Polar's codebase for patterns
- Check `.claude/skills/` for domain-specific guidance
- Ask questions in development channel
- Consult implementation plan for roadmap

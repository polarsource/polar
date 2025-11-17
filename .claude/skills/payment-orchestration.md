# Payment Orchestration Skill

## Purpose
Guide the development of AgentPay's intelligent payment routing and orchestration system that selects optimal payment rails based on cost, speed, compliance, and currency requirements.

## Context
AgentPay needs to orchestrate payments across multiple rails:
- **PIX** (Brazil) - instant, low-cost
- **PayTo** (Australia) - real-time account-to-account
- **Stripe** - global card payments
- **Wise** - cross-border transfers
- **SEPA** (Europe) - bank transfers
- **USDC** - stablecoin payments

## Core Responsibilities

### 1. Payment Rail Selection Engine
- Analyze transaction context (amount, currency, geography, urgency)
- Calculate total cost including fees, FX rates, and time value
- Select optimal rail using decision matrix
- Provide fallback options if primary rail fails

### 2. Adapter Pattern Implementation
Each payment rail should have:
```python
class PaymentRailAdapter(ABC):
    @abstractmethod
    async def initiate_payment(self, payment_request: PaymentRequest) -> PaymentResponse:
        """Initiate payment on this rail"""
        pass

    @abstractmethod
    async def check_status(self, payment_id: str) -> PaymentStatus:
        """Check payment status"""
        pass

    @abstractmethod
    def calculate_cost(self, amount: Decimal, currency: str) -> Cost:
        """Calculate total cost for this rail"""
        pass

    @abstractmethod
    def get_capabilities(self) -> RailCapabilities:
        """Return rail capabilities (currencies, limits, speed)"""
        pass
```

### 3. Routing Logic
```python
async def select_optimal_rail(
    amount: Decimal,
    from_currency: str,
    to_currency: str,
    from_country: str,
    to_country: str,
    urgency: PaymentUrgency,
    user_preferences: Optional[UserPreferences] = None
) -> PaymentRail:
    """
    Select optimal payment rail based on:
    - Cost efficiency
    - Settlement speed
    - Compliance requirements
    - User preferences
    - Availability
    """
```

### 4. Integration Points with Polar
- Extend `server/polar/integrations/` with new payment rail modules
- Use existing `stripe` integration as reference
- Follow Polar's service/repository pattern
- Use SQLAlchemy models for payment tracking

## Implementation Guidelines

### Backend Structure
```
server/polar/
├── payment_orchestration/
│   ├── __init__.py
│   ├── service.py              # Orchestration logic
│   ├── repository.py           # Payment persistence
│   ├── schemas.py              # Pydantic models
│   ├── endpoints.py            # API routes
│   ├── rails/
│   │   ├── __init__.py
│   │   ├── base.py            # Abstract base adapter
│   │   ├── pix.py             # PIX integration
│   │   ├── payto.py           # PayTo integration
│   │   ├── stripe_adapter.py  # Wrap existing Stripe
│   │   ├── wise.py            # Wise integration
│   │   └── sepa.py            # SEPA integration
│   ├── routing.py             # Rail selection logic
│   └── tasks.py               # Background jobs (Dramatiq)
```

### Database Models
```python
class OrchestrationPayment(Base):
    __tablename__ = "orchestration_payments"

    id: Mapped[UUID]
    amount: Mapped[Decimal]
    currency: Mapped[str]
    from_country: Mapped[str]
    to_country: Mapped[str]
    selected_rail: Mapped[str]
    alternative_rails: Mapped[list[str]]  # JSON array
    cost_breakdown: Mapped[dict]  # JSON
    status: Mapped[PaymentStatus]
    explanation: Mapped[str]  # Why this rail was chosen
    external_payment_id: Mapped[str]
    created_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]
```

### Key Features to Implement

1. **Cost Calculator**
   - Real-time FX rates
   - Fee structure per rail
   - Time-value consideration for slower rails

2. **Explainability**
   - Generate human-readable explanation for rail selection
   - "You're paying via PIX. Funds arrive instantly. Fee: 0.4%."

3. **Fallback Handling**
   - Automatic retry with alternative rail if primary fails
   - User notification of rail change

4. **Compliance Checks**
   - KYC/AML requirements per rail
   - Transaction limits
   - Sanctions screening

## Testing Strategy

### Unit Tests
```python
class TestPaymentOrchestration:
    async def test_pix_selected_for_brazil_domestic(self):
        """PIX should be selected for BRL → BRL in Brazil"""

    async def test_wise_selected_for_cross_border(self):
        """Wise should be optimal for cross-border small amounts"""

    async def test_fallback_on_rail_failure(self):
        """Should retry with alternative rail on failure"""
```

### Integration Tests
- Test actual API calls to sandbox environments
- Mock external services for CI/CD

## Questions to Consider
1. How to handle partial payments or payment splitting?
2. Should we implement payment batching for efficiency?
3. How to handle currency conversion timing (lock rates)?
4. What's the retry strategy for failed payments?
5. How to handle webhook callbacks from multiple rails?

## Success Metrics
- Payment success rate > 99%
- Average cost reduction vs single-rail: > 15%
- Rail selection accuracy: > 95%
- Average selection time: < 200ms

## Related Skills
- `intent-recognition.md` - Extracting payment intent from conversations
- `trust-layer.md` - Building explainability and transparency
- `cross-border-routing.md` - Optimizing international payments

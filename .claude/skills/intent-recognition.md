# Intent Recognition & NLU Skill

## Purpose
Build AgentPay's conversational intelligence layer that detects, extracts, and understands transactional intent from natural language across messaging platforms.

## Context
AgentPay must understand payment intent from messages like:
- "I'll pay you tomorrow."
- "Can you send the invoice?"
- "Let's split this $60 dinner."
- "Transfer 500 BRL to the usual account"
- "Yes, approved for the project"

## Core Responsibilities

### 1. Intent Classification
Classify messages into transactional categories:
```python
class TransactionIntent(str, Enum):
    PAYMENT_PROMISE = "payment_promise"          # "I'll pay you"
    INVOICE_REQUEST = "invoice_request"          # "Send me an invoice"
    PAYMENT_CONFIRMATION = "payment_confirmation" # "Payment sent"
    SPLIT_REQUEST = "split_request"              # "Let's split this"
    APPROVAL = "approval"                        # "Approved"
    PAYMENT_INQUIRY = "payment_inquiry"          # "Did you receive it?"
    PRICE_NEGOTIATION = "price_negotiation"      # "How about $50?"
    NONE = "none"                                # Not transaction-related
```

### 2. Entity Extraction
Extract structured data from unstructured text:
```python
@dataclass
class ExtractedEntities:
    amount: Optional[Decimal]
    currency: Optional[str]
    due_date: Optional[datetime]
    payment_method: Optional[str]
    recipient: Optional[str]
    description: Optional[str]
    confidence: float
```

### 3. Context Management
Maintain conversation state:
```python
class ConversationContext:
    """Track multi-turn conversations"""
    conversation_id: str
    participants: list[str]
    intent_history: list[TransactionIntent]
    extracted_entities: dict[str, Any]
    platform: Platform  # WhatsApp, Slack, etc.
    language: str

    def merge_entities(self, new_entities: ExtractedEntities) -> None:
        """Merge new entities with existing context"""

    def infer_missing_entities(self) -> dict[str, Any]:
        """Use context to fill in missing information"""
```

## Implementation Guidelines

### Backend Structure
```
server/polar/
├── intent_recognition/
│   ├── __init__.py
│   ├── service.py              # Main NLU service
│   ├── schemas.py              # Intent/Entity models
│   ├── endpoints.py            # Webhook receivers
│   ├── classifiers/
│   │   ├── __init__.py
│   │   ├── intent_classifier.py    # Intent classification
│   │   ├── entity_extractor.py     # Entity extraction
│   │   └── confidence_scorer.py    # Confidence calculation
│   ├── context/
│   │   ├── __init__.py
│   │   ├── conversation_manager.py
│   │   └── entity_resolver.py
│   ├── nlp/
│   │   ├── __init__.py
│   │   ├── preprocessor.py    # Text normalization
│   │   ├── currency_parser.py # Parse currency formats
│   │   ├── date_parser.py     # Parse relative dates
│   │   └── amount_parser.py   # Parse amounts with context
│   └── tasks.py               # Async processing
```

### LLM Integration Strategy

**Option 1: Direct LLM API**
```python
async def classify_intent_with_llm(
    message: str,
    context: ConversationContext
) -> IntentResult:
    """
    Use Claude/GPT for intent classification
    - Structured output with JSON schema
    - Few-shot examples for accuracy
    - Fallback to rule-based for common patterns
    """

    prompt = f"""
    Analyze this message for payment intent:

    Message: "{message}"
    Context: {context.to_prompt()}

    Extract:
    1. Intent: [payment_promise|invoice_request|payment_confirmation|...]
    2. Amount: [number]
    3. Currency: [ISO code]
    4. Due date: [ISO datetime]
    5. Confidence: [0-1]

    Return JSON.
    """
```

**Option 2: Fine-tuned Model**
- Fine-tune smaller model on payment conversations
- Lower latency, lower cost
- Host on Replicate or Modal

**Option 3: Hybrid Approach** (Recommended)
- Rule-based for obvious patterns (high confidence, low latency)
- LLM for ambiguous cases (higher accuracy)
- Cache common patterns

### Database Models
```python
class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[UUID]
    conversation_id: Mapped[UUID]
    platform: Mapped[str]  # whatsapp, slack, etc.
    sender_id: Mapped[str]
    message_text: Mapped[str]
    detected_intent: Mapped[str | None]
    extracted_entities: Mapped[dict]  # JSON
    confidence_score: Mapped[float]
    processing_time_ms: Mapped[int]
    created_at: Mapped[datetime]

class IntentAction(Base):
    __tablename__ = "intent_actions"

    id: Mapped[UUID]
    message_id: Mapped[UUID]
    intent: Mapped[str]
    action_taken: Mapped[str]  # payment_initiated, invoice_sent, etc.
    orchestration_payment_id: Mapped[UUID | None]
    created_at: Mapped[datetime]
```

### Key Features to Implement

1. **Multi-language Support**
   - Portuguese (BR) priority
   - English
   - Spanish (LATAM)
   - Locale-aware currency/date parsing

2. **Slang & Informal Language**
   ```python
   INFORMAL_PATTERNS = {
       "pt-BR": {
           "vou pagar": "payment_promise",
           "manda a cobrança": "invoice_request",
           "paguei": "payment_confirmation",
           "racha comigo": "split_request",
       },
       "en-US": {
           "i'll venmo you": "payment_promise",
           "send invoice": "invoice_request",
           "paid": "payment_confirmation",
           "split it": "split_request",
       }
   }
   ```

3. **Ambiguity Resolution**
   ```python
   async def resolve_ambiguity(
       message: str,
       context: ConversationContext
   ) -> ResolutionStrategy:
       """
       Handle ambiguous messages:
       - "I'll pay you" → how much? when?
       - Use context to infer OR ask clarifying questions
       """
   ```

4. **Confidence Thresholds**
   ```python
   CONFIDENCE_THRESHOLDS = {
       "high": 0.9,      # Auto-execute
       "medium": 0.7,    # Ask confirmation
       "low": 0.5,       # Ask clarifying questions
       "reject": 0.5     # Below this, don't act
   }
   ```

## Integration Points

### Messaging Platform Webhooks
```python
@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(
    payload: WhatsAppWebhook,
    intent_service: IntentService = Depends()
):
    """Process incoming WhatsApp message"""

    result = await intent_service.process_message(
        message=payload.message.text,
        conversation_id=payload.conversation.id,
        platform=Platform.WHATSAPP
    )

    if result.confidence > CONFIDENCE_THRESHOLDS["high"]:
        # Auto-trigger payment orchestration
        await payment_orchestration_service.initiate_payment(result)
    elif result.confidence > CONFIDENCE_THRESHOLDS["medium"]:
        # Ask for confirmation
        await send_confirmation_message(payload.conversation.id, result)
```

### With Payment Orchestration
```python
# After extracting intent → trigger orchestration
if intent == TransactionIntent.PAYMENT_PROMISE:
    payment_request = PaymentRequest(
        amount=entities.amount,
        currency=entities.currency,
        due_date=entities.due_date or datetime.now() + timedelta(days=1)
    )

    rail = await payment_orchestration.select_optimal_rail(payment_request)
    await send_payment_link(conversation_id, rail.payment_url)
```

## Testing Strategy

### Unit Tests
```python
class TestIntentClassification:
    def test_payment_promise_detection(self):
        assert classify("I'll pay you tomorrow") == TransactionIntent.PAYMENT_PROMISE

    def test_amount_extraction_various_formats(self):
        assert extract_amount("$50") == (50, "USD")
        assert extract_amount("R$ 100") == (100, "BRL")
        assert extract_amount("fifty dollars") == (50, "USD")

    def test_relative_date_parsing(self):
        assert parse_date("tomorrow") == datetime.now() + timedelta(days=1)
        assert parse_date("next friday") == next_friday()
```

### Integration Tests
```python
async def test_end_to_end_whatsapp_flow():
    """Test full flow from webhook to payment initiation"""

    # Simulate WhatsApp message
    response = await client.post("/webhooks/whatsapp", json={
        "message": {"text": "I'll pay you $50 tomorrow"},
        "conversation": {"id": "test_conv_123"}
    })

    # Verify intent was detected
    intent = await get_latest_intent("test_conv_123")
    assert intent.intent == TransactionIntent.PAYMENT_PROMISE
    assert intent.entities.amount == 50

    # Verify payment was orchestrated
    payment = await get_orchestration_payment(intent.action_id)
    assert payment is not None
```

### Test Data
Create dataset of real conversational patterns:
```
datasets/
├── intent_classification/
│   ├── payment_promises.jsonl
│   ├── invoice_requests.jsonl
│   └── payment_confirmations.jsonl
└── entity_extraction/
    ├── amounts.jsonl
    ├── dates.jsonl
    └── multi_entity.jsonl
```

## LLM Prompt Engineering

### Few-shot Examples
```python
INTENT_CLASSIFICATION_EXAMPLES = [
    {
        "message": "I'll send the payment by Friday",
        "intent": "payment_promise",
        "entities": {"due_date": "2024-01-19"}
    },
    {
        "message": "Can you send me the invoice for the website project?",
        "intent": "invoice_request",
        "entities": {"description": "website project"}
    },
    # ... more examples
]
```

### Structured Output
```python
INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": ["payment_promise", ...]},
        "entities": {
            "type": "object",
            "properties": {
                "amount": {"type": "number"},
                "currency": {"type": "string"},
                "due_date": {"type": "string", "format": "date-time"}
            }
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1}
    }
}
```

## Success Metrics
- Intent classification accuracy: > 95%
- Entity extraction F1 score: > 90%
- Average latency: < 500ms
- False positive rate: < 2%
- User correction rate: < 5%

## Related Skills
- `payment-orchestration.md` - Trigger payments from intent
- `conversational-payments.md` - Full conversational flow
- `trust-layer.md` - Explainability of intent detection

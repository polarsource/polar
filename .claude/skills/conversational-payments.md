# Conversational Payments Skill

## Purpose
Implement seamless, conversational payment flows that feel natural within messaging platforms while maintaining security and trust.

## Context
Traditional payment flows:
1. User opens separate payment app
2. Enters details manually
3. Confirms payment
4. Returns to conversation
5. Manually confirms payment was sent

AgentPay conversational flow:
1. User expresses intent in conversation
2. AgentPay detects and confirms
3. Payment happens inline
4. Auto-confirmation and tracking

## Core User Flows

### Flow 1: Invoice Request → Payment
```
User:     "Can you send me the invoice for the logo design?"

AgentPay: "I'll create an invoice for the logo design project.
           Amount: $500 USD
           [✓ Looks correct] [✗ Edit amount]"

User:     [✓ Looks correct]

AgentPay: "Invoice #1234 created
           💳 Pay now: [link]
           💰 Payment options: PIX (instant) | Credit Card | Bank Transfer"

User:     [Clicks PIX]

AgentPay: "Opening PIX payment...
           Amount: $500 USD = R$ 2,450 BRL
           Fee: R$ 9.80 (0.4%)
           Total: R$ 2,459.80

           Scan QR code or copy PIX key:
           [QR CODE]
           Key: 00020126...

           ⏱️ This code expires in 15 minutes"

User:     [Pays via banking app]

AgentPay: "✅ Payment received!
           Amount: R$ 2,459.80
           Arrived: 2:34 PM
           Receipt: [link]

           📊 This payment was logged under 'Logo Design - Client A'"
```

### Flow 2: Split Payment Request
```
User A:   "Let's split this $60 dinner"

AgentPay: "I'll help split $60 between you two.
           $30 each to @UserA
           Is this correct?"

User B:   "Yes"

AgentPay: "@UserB, you owe @UserA $30
           Pay now: [Link]

           Payment options:
           • PIX (instant, free)
           • Stripe (instant, 2.9% + $0.30)
           • Bank transfer (1-2 days, free)"

User B:   [Selects PIX, pays]

AgentPay: "✅ @UserB paid @UserA $30
           All settled up!"
```

### Flow 3: Recurring Payment Detection
```
User:     "Monthly website maintenance - $200"

AgentPay: "I noticed this is similar to last month's payment.
           Make this recurring?

           [✓ Yes, auto-invoice monthly] [One-time only]"

User:     [✓ Yes, auto-invoice monthly]

AgentPay: "Great! I'll automatically:
           • Generate invoice on the 1st of each month
           • Send payment reminder on the 3rd
           • Notify you when paid

           You can change this anytime."
```

### Flow 4: Payment Inquiry & Status
```
User:     "Did John pay me for the consulting work?"

AgentPay: "Checking payments from @John...

           ✅ Yes! Paid 2 days ago
           Amount: $1,500 USD
           Method: Bank transfer
           Invoice: #789 - 'Consulting - Q4 Strategy'
           Receipt: [link]"
```

### Flow 5: Price Negotiation
```
User A:   "How about $400 for the website?"

AgentPay: "Price update detected:
           Original: $500
           Proposed: $400

           @SellerB, do you accept $400?"

User B:   "Make it $450 and we have a deal"

AgentPay: "@UserA, @UserB counter-offered $450
           [✓ Accept $450] [Counter-offer] [✗ Decline]"

User A:   [✓ Accept $450]

AgentPay: "✅ Price agreed: $450
           Creating invoice...
           [Invoice #1235]"
```

## Implementation Structure

### Backend Components
```
server/polar/conversational_payments/
├── __init__.py
├── service.py                  # Main orchestrator
├── flows/
│   ├── __init__.py
│   ├── base_flow.py           # Abstract flow
│   ├── invoice_flow.py        # Invoice request → payment
│   ├── split_payment_flow.py  # Split payment handling
│   ├── recurring_flow.py      # Recurring payment setup
│   ├── inquiry_flow.py        # Payment status inquiries
│   └── negotiation_flow.py    # Price negotiation
├── confirmation/
│   ├── __init__.py
│   ├── confirmation_service.py # Handle user confirmations
│   └── timeout_handler.py      # Handle confirmation timeouts
├── rendering/
│   ├── __init__.py
│   ├── message_renderer.py    # Format messages for platforms
│   ├── button_builder.py      # Build interactive buttons
│   └── qr_generator.py        # Generate QR codes
└── state/
    ├── __init__.py
    ├── flow_state_manager.py  # Track flow state
    └── conversation_lock.py   # Prevent concurrent flows
```

### Flow State Machine

```python
from enum import Enum
from dataclasses import dataclass

class FlowState(str, Enum):
    INITIATED = "initiated"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED = "confirmed"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_COMPLETED = "payment_completed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

@dataclass
class ConversationalFlow:
    flow_id: UUID
    flow_type: str  # invoice, split_payment, etc.
    conversation_id: UUID
    state: FlowState
    context: dict  # Flow-specific data
    created_at: datetime
    updated_at: datetime
    expires_at: datetime

class FlowStateMachine:
    """Manage flow state transitions"""

    async def transition(
        self,
        flow: ConversationalFlow,
        new_state: FlowState,
        trigger: str
    ) -> ConversationalFlow:
        """
        Validate and execute state transition
        Log all transitions for audit
        """

    async def handle_timeout(self, flow: ConversationalFlow) -> None:
        """Handle flows that expire without completion"""
```

### Message Rendering System

```python
class MessageRenderer:
    """Render messages for different platforms"""

    def render_confirmation(
        self,
        platform: Platform,
        message: str,
        options: list[ConfirmationOption]
    ) -> PlatformMessage:
        """
        Render confirmation with platform-specific UI:
        - WhatsApp: Interactive buttons
        - Slack: Action blocks
        - Telegram: Inline keyboard
        - Web: React components
        """

    def render_payment_options(
        self,
        platform: Platform,
        amount: Decimal,
        currency: str,
        available_rails: list[PaymentRail]
    ) -> PlatformMessage:
        """
        Render payment options with:
        - Rail name and description
        - Cost breakdown
        - Estimated completion time
        - Action buttons
        """

    def render_payment_link(
        self,
        platform: Platform,
        payment: OrchestrationPayment
    ) -> PlatformMessage:
        """
        Render payment link with:
        - QR code (for PIX, crypto)
        - Copy-paste key
        - Deep link (opens banking app)
        - Web fallback
        """

# Platform-specific rendering
class WhatsAppRenderer(MessageRenderer):
    def render_confirmation(self, message: str, options: list) -> WhatsAppMessage:
        return WhatsAppMessage(
            text=message,
            buttons=[
                WhatsAppButton(id=opt.id, title=opt.label)
                for opt in options
            ]
        )

class SlackRenderer(MessageRenderer):
    def render_confirmation(self, message: str, options: list) -> SlackMessage:
        return SlackMessage(
            blocks=[
                {"type": "section", "text": {"type": "mrkdwn", "text": message}},
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": opt.label},
                            "action_id": opt.id
                        }
                        for opt in options
                    ]
                }
            ]
        )
```

### Confirmation Handling

```python
class ConfirmationService:
    """Handle user confirmations and timeouts"""

    async def request_confirmation(
        self,
        flow: ConversationalFlow,
        question: str,
        options: list[ConfirmationOption],
        timeout_seconds: int = 300
    ) -> ConfirmationRequest:
        """
        Request confirmation from user:
        1. Render message with options
        2. Store pending confirmation
        3. Set timeout task
        4. Return confirmation ID
        """

        confirmation = ConfirmationRequest(
            id=uuid4(),
            flow_id=flow.flow_id,
            question=question,
            options=options,
            expires_at=datetime.now() + timedelta(seconds=timeout_seconds)
        )

        # Store in database
        await self.repository.create_confirmation(confirmation)

        # Schedule timeout task
        await self.scheduler.schedule(
            task=self.handle_timeout,
            args=[confirmation.id],
            delay=timeout_seconds
        )

        # Render and send message
        message = self.renderer.render_confirmation(
            platform=flow.conversation.platform,
            message=question,
            options=options
        )
        await self.messaging.send_message(flow.conversation_id, message)

        return confirmation

    async def handle_confirmation(
        self,
        confirmation_id: UUID,
        selected_option: str
    ) -> FlowState:
        """
        Process user's confirmation choice:
        1. Validate confirmation exists and hasn't expired
        2. Cancel timeout task
        3. Transition flow state
        4. Continue flow execution
        """

    async def handle_timeout(self, confirmation_id: UUID) -> None:
        """
        Handle confirmation timeout:
        1. Mark confirmation as expired
        2. Transition flow to timeout state
        3. Notify user
        4. Clean up resources
        """
```

### Database Models

```python
class ConversationalFlow(Base):
    __tablename__ = "conversational_flows"

    id: Mapped[UUID]
    flow_type: Mapped[str]
    conversation_id: Mapped[UUID]
    state: Mapped[str]
    context: Mapped[dict]  # JSON
    orchestration_payment_id: Mapped[UUID | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    expires_at: Mapped[datetime]

class FlowStateTransition(Base):
    __tablename__ = "flow_state_transitions"

    id: Mapped[UUID]
    flow_id: Mapped[UUID]
    from_state: Mapped[str]
    to_state: Mapped[str]
    trigger: Mapped[str]
    metadata: Mapped[dict]  # JSON
    created_at: Mapped[datetime]

class ConfirmationRequest(Base):
    __tablename__ = "confirmation_requests"

    id: Mapped[UUID]
    flow_id: Mapped[UUID]
    question: Mapped[str]
    options: Mapped[list[dict]]  # JSON array
    selected_option: Mapped[str | None]
    responded_at: Mapped[datetime | None]
    expires_at: Mapped[datetime]
    created_at: Mapped[datetime]
```

## User Experience Principles

### 1. Minimize Friction
- Pre-fill all known information
- Offer smart defaults
- One-tap actions when possible
- Progressive disclosure (don't overwhelm)

### 2. Build Trust
- Always explain what's happening
- Show cost breakdown before payment
- Provide receipts and confirmation
- Make it easy to cancel or edit

### 3. Maintain Context
- Remember conversation history
- Reference previous payments
- Suggest based on patterns
- Keep user in the flow

### 4. Handle Errors Gracefully
- Clear error messages
- Offer alternatives
- Don't lose user's progress
- Make it easy to retry

### 5. Be Proactive but Not Pushy
- Detect intent, don't force it
- Offer help, don't demand action
- Remind gently, don't nag
- Let users control the pace

## Platform-Specific Considerations

### WhatsApp
- Use interactive buttons (max 3)
- Keep messages concise
- Use emojis for visual cues
- Support both text and button responses
- Handle list messages for multiple options

### Slack
- Use Block Kit for rich UI
- Leverage ephemeral messages for private info
- Use threads to keep channels clean
- Update messages in place for status changes

### Telegram
- Use inline keyboards
- Support inline payments (Telegram Payments)
- Use HTML/Markdown formatting
- Send photos for QR codes

### Web Chat
- Use React components for rich UI
- Support file uploads (receipts, invoices)
- Enable desktop notifications
- Persist state across refreshes

### AI Agents (API)
- Return structured JSON responses
- Include confidence scores
- Provide alternative actions
- Support idempotent operations

## Testing Strategy

### Unit Tests
```python
class TestInvoiceFlow:
    async def test_happy_path(self):
        """Test complete invoice flow from request to payment"""

    async def test_amount_edit(self):
        """Test user editing invoice amount"""

    async def test_confirmation_timeout(self):
        """Test flow timeout handling"""

    async def test_payment_failure_fallback(self):
        """Test fallback to alternative rail on payment failure"""
```

### Integration Tests
```python
async def test_whatsapp_invoice_flow():
    """Test full flow through WhatsApp"""

    # Simulate WhatsApp message
    await webhook_handler.handle_message({
        "from": "user_123",
        "text": "Send me invoice for website work"
    })

    # Verify intent detected
    intent = await get_latest_intent("user_123")
    assert intent.intent == TransactionIntent.INVOICE_REQUEST

    # Verify confirmation requested
    confirmation = await get_pending_confirmation("user_123")
    assert confirmation is not None

    # Simulate button press
    await webhook_handler.handle_button_press({
        "from": "user_123",
        "button_id": confirmation.options[0].id
    })

    # Verify payment orchestrated
    payment = await get_orchestration_payment(intent.flow_id)
    assert payment.status == PaymentStatus.PENDING
```

### E2E Tests
- Use Playwright to test web chat flows
- Use WhatsApp Business API sandbox
- Use Slack test workspace
- Mock payment rails for safety

## Success Metrics

### Conversion Metrics
- Intent → Confirmation rate: > 80%
- Confirmation → Payment initiation: > 90%
- Payment initiation → Completion: > 95%
- Overall intent → Completion: > 65%

### Experience Metrics
- Time to payment: < 2 minutes
- Number of messages to completion: < 5
- User satisfaction (NPS): > 70
- Repeat usage rate: > 60%

### Error Metrics
- Confirmation timeout rate: < 10%
- Payment failure rate: < 1%
- User cancellation rate: < 5%
- Error recovery success: > 90%

## Related Skills
- `intent-recognition.md` - Detect payment intent
- `payment-orchestration.md` - Execute payments
- `trust-layer.md` - Build user trust

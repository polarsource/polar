# API Integration Skill

## Purpose
Guide integration of external payment rails, messaging platforms, accounting systems, and AI services into AgentPay.

## Integration Categories

### 1. Payment Rails Integration

#### PIX (Brazil)

```python
# server/polar/payment_orchestration/rails/pix/client.py

from dataclasses import dataclass
import httpx

@dataclass
class PIXPaymentRequest:
    amount: Decimal
    currency: str  # BRL
    payer_cpf: str  # Brazilian tax ID
    payee_cpf: str
    description: str
    expiration_minutes: int = 15

class PIXClient:
    """
    Integrate with Brazilian PIX payment system
    Options:
    - Direct integration with Brazilian banks (BB, Itaú, Bradesco)
    - PSP providers (MercadoPago, PagSeguro, Stripe Brasil)
    - Fintech APIs (Asaas, Iugu, Ebanx)
    """

    def __init__(self, api_key: str, sandbox: bool = False):
        self.api_key = api_key
        self.base_url = (
            "https://api-sandbox.pix.com.br"
            if sandbox
            else "https://api.pix.com.br"
        )
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {api_key}"}
        )

    async def create_qr_code(
        self,
        request: PIXPaymentRequest
    ) -> PIXQRCode:
        """
        Create PIX QR code for payment
        Returns:
        - QR code image (base64)
        - PIX copy-paste code
        - Payment ID for tracking
        """

        response = await self.client.post("/v1/pix/qrcode", json={
            "amount": float(request.amount),
            "payer_cpf": request.payer_cpf,
            "payee_cpf": request.payee_cpf,
            "description": request.description,
            "expiration": request.expiration_minutes
        })

        data = response.json()

        return PIXQRCode(
            payment_id=data["id"],
            qr_code_image=data["qr_code_base64"],
            qr_code_text=data["qr_code_text"],
            expires_at=datetime.fromisoformat(data["expires_at"])
        )

    async def check_payment_status(
        self,
        payment_id: str
    ) -> PIXPaymentStatus:
        """Check if PIX payment was completed"""

        response = await self.client.get(f"/v1/pix/payments/{payment_id}")
        data = response.json()

        return PIXPaymentStatus(
            payment_id=payment_id,
            status=data["status"],  # pending, completed, expired, failed
            completed_at=datetime.fromisoformat(data["completed_at"])
            if data.get("completed_at")
            else None
        )

    async def setup_webhook(
        self,
        webhook_url: str,
        events: list[str]
    ) -> None:
        """
        Register webhook for PIX payment events:
        - payment.completed
        - payment.expired
        - payment.refunded
        """

        await self.client.post("/v1/webhooks", json={
            "url": webhook_url,
            "events": events
        })


# Adapter implementation
class PIXAdapter(PaymentRailAdapter):
    """PIX payment rail adapter"""

    def __init__(self, client: PIXClient):
        self.client = client

    async def initiate_payment(
        self,
        request: PaymentRequest
    ) -> PaymentResponse:
        """Initiate PIX payment"""

        qr_code = await self.client.create_qr_code(
            PIXPaymentRequest(
                amount=request.amount,
                currency="BRL",
                payer_cpf=request.payer.tax_id,
                payee_cpf=request.payee.tax_id,
                description=request.description
            )
        )

        return PaymentResponse(
            payment_id=qr_code.payment_id,
            status=PaymentStatus.PENDING,
            payment_url=None,  # PIX uses QR code
            qr_code=qr_code.qr_code_image,
            qr_code_text=qr_code.qr_code_text,
            expires_at=qr_code.expires_at,
            estimated_completion=timedelta(seconds=5)
        )

    async def check_status(
        self,
        payment_id: str
    ) -> PaymentStatus:
        """Check PIX payment status"""

        status = await self.client.check_payment_status(payment_id)
        return self._map_status(status.status)

    def calculate_cost(
        self,
        amount: Decimal,
        currency: str
    ) -> Cost:
        """Calculate PIX transaction cost"""

        # PIX is typically low-cost
        fee = amount * Decimal("0.004")  # 0.4% fee

        return Cost(
            base_amount=amount,
            fee=fee,
            total=amount + fee,
            currency=currency
        )

    def get_capabilities(self) -> RailCapabilities:
        """Return PIX capabilities"""

        return RailCapabilities(
            name="PIX",
            display_name="PIX (Instant Payment)",
            currencies=["BRL"],
            countries=["BR"],
            min_amount=Decimal("0.01"),
            max_amount=Decimal("1000000"),
            settlement_speed=timedelta(seconds=5),
            requires_kyc=True,
            supports_refunds=True
        )
```

#### Stripe Integration

```python
# server/polar/payment_orchestration/rails/stripe_adapter.py

import stripe
from polar.integrations.stripe.service import StripeService

class StripePaymentAdapter(PaymentRailAdapter):
    """
    Wrap Polar's existing Stripe integration
    for payment orchestration
    """

    def __init__(self, stripe_service: StripeService):
        self.stripe_service = stripe_service

    async def initiate_payment(
        self,
        request: PaymentRequest
    ) -> PaymentResponse:
        """Create Stripe payment intent"""

        intent = await self.stripe_service.create_payment_intent(
            amount=int(request.amount * 100),  # Convert to cents
            currency=request.currency.lower(),
            metadata={
                "conversation_id": str(request.conversation_id),
                "description": request.description
            }
        )

        return PaymentResponse(
            payment_id=intent.id,
            status=PaymentStatus.PENDING,
            payment_url=intent.client_secret,
            estimated_completion=timedelta(seconds=10)
        )

    def calculate_cost(
        self,
        amount: Decimal,
        currency: str
    ) -> Cost:
        """Calculate Stripe fees"""

        # Stripe: 2.9% + $0.30
        fee = (amount * Decimal("0.029")) + Decimal("0.30")

        return Cost(
            base_amount=amount,
            fee=fee,
            total=amount + fee,
            currency=currency
        )
```

#### Wise Integration (Cross-border)

```python
# server/polar/payment_orchestration/rails/wise.py

class WiseClient:
    """
    Integrate with Wise (formerly TransferWise)
    for cross-border payments
    """

    async def create_transfer(
        self,
        source_currency: str,
        target_currency: str,
        amount: Decimal,
        recipient_id: str
    ) -> WiseTransfer:
        """Create Wise transfer"""

    async def get_quote(
        self,
        source_currency: str,
        target_currency: str,
        amount: Decimal
    ) -> WiseQuote:
        """
        Get real-time quote including:
        - Exchange rate
        - Fee
        - Estimated delivery time
        """
```

### 2. Messaging Platforms Integration

#### WhatsApp Business API

```python
# server/polar/messaging/adapters/whatsapp.py

from dataclasses import dataclass

@dataclass
class WhatsAppMessage:
    to: str  # Phone number
    text: str
    buttons: list[WhatsAppButton] = None

class WhatsAppClient:
    """
    Integrate with WhatsApp Business API
    Requires: WhatsApp Business Account + Facebook App
    """

    def __init__(
        self,
        phone_number_id: str,
        access_token: str
    ):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.base_url = "https://graph.facebook.com/v18.0"

    async def send_message(
        self,
        message: WhatsAppMessage
    ) -> str:
        """Send text message"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{self.phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": message.to,
                    "type": "text",
                    "text": {"body": message.text}
                }
            )

        data = response.json()
        return data["messages"][0]["id"]

    async def send_interactive_message(
        self,
        to: str,
        message: str,
        buttons: list[WhatsAppButton]
    ) -> str:
        """Send message with interactive buttons (max 3)"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{self.phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "interactive",
                    "interactive": {
                        "type": "button",
                        "body": {"text": message},
                        "action": {
                            "buttons": [
                                {
                                    "type": "reply",
                                    "reply": {
                                        "id": btn.id,
                                        "title": btn.title
                                    }
                                }
                                for btn in buttons[:3]  # Max 3 buttons
                            ]
                        }
                    }
                }
            )

        data = response.json()
        return data["messages"][0]["id"]

    async def send_image(
        self,
        to: str,
        image_url: str,
        caption: str = None
    ) -> str:
        """Send image (useful for QR codes)"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{self.phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "image",
                    "image": {
                        "link": image_url,
                        "caption": caption
                    }
                }
            )

        data = response.json()
        return data["messages"][0]["id"]


# Webhook handler
@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(
    request: Request,
    message_router: MessageRouter = Depends()
):
    """
    Handle incoming WhatsApp messages
    Webhook setup: https://developers.facebook.com/docs/whatsapp/webhooks
    """

    payload = await request.json()

    # Verify webhook (first-time setup)
    if request.query_params.get("hub.mode") == "subscribe":
        if request.query_params.get("hub.verify_token") == settings.WHATSAPP_VERIFY_TOKEN:
            return Response(content=request.query_params.get("hub.challenge"))
        return Response(status_code=403)

    # Process incoming message
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change["field"] == "messages":
                value = change["value"]
                for message in value.get("messages", []):
                    await message_router.route_message(
                        IncomingMessage(
                            platform=Platform.WHATSAPP,
                            sender_id=message["from"],
                            text=message.get("text", {}).get("body"),
                            message_id=message["id"],
                            timestamp=datetime.fromtimestamp(
                                int(message["timestamp"])
                            )
                        )
                    )

    return {"status": "ok"}
```

#### Slack Integration

```python
# server/polar/messaging/adapters/slack.py

from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.signature import SignatureVerifier

class SlackClient:
    """Integrate with Slack"""

    def __init__(self, bot_token: str):
        self.client = AsyncWebClient(token=bot_token)

    async def send_message(
        self,
        channel: str,
        text: str,
        blocks: list[dict] = None
    ) -> str:
        """Send Slack message"""

        response = await self.client.chat_postMessage(
            channel=channel,
            text=text,
            blocks=blocks
        )

        return response["ts"]  # Message timestamp (ID)

    async def send_interactive_message(
        self,
        channel: str,
        text: str,
        actions: list[dict]
    ) -> str:
        """Send message with action buttons"""

        blocks = [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": text}
            },
            {
                "type": "actions",
                "elements": actions
            }
        ]

        return await self.send_message(channel, text, blocks)


# Event handler
@router.post("/webhooks/slack/events")
async def slack_events(
    request: Request,
    message_router: MessageRouter = Depends()
):
    """Handle Slack events"""

    # Verify request signature
    verifier = SignatureVerifier(settings.SLACK_SIGNING_SECRET)
    if not verifier.is_valid_request(
        await request.body(),
        request.headers
    ):
        return Response(status_code=403)

    payload = await request.json()

    # URL verification (first-time setup)
    if payload["type"] == "url_verification":
        return {"challenge": payload["challenge"]}

    # Handle message event
    if payload["type"] == "event_callback":
        event = payload["event"]

        if event["type"] == "message" and not event.get("bot_id"):
            await message_router.route_message(
                IncomingMessage(
                    platform=Platform.SLACK,
                    sender_id=event["user"],
                    text=event["text"],
                    message_id=event["ts"],
                    channel_id=event["channel"]
                )
            )

    return {"status": "ok"}


@router.post("/webhooks/slack/interactions")
async def slack_interactions(
    request: Request,
    confirmation_service: ConfirmationService = Depends()
):
    """Handle Slack button clicks"""

    form_data = await request.form()
    payload = json.loads(form_data["payload"])

    if payload["type"] == "block_actions":
        action = payload["actions"][0]

        await confirmation_service.handle_confirmation(
            confirmation_id=UUID(action["value"]),
            selected_option=action["action_id"]
        )

    return {"status": "ok"}
```

### 3. Accounting System Integration

#### QuickBooks

```python
# server/polar/context_memory/accounting_sync/adapters/quickbooks.py

from intuitlib.client import AuthClient
from quickbooks import QuickBooks

class QuickBooksClient:
    """Integrate with QuickBooks Online"""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        realm_id: str
    ):
        self.auth_client = AuthClient(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=settings.QUICKBOOKS_REDIRECT_URI,
            environment="production"
        )

        # Refresh access token
        self.auth_client.refresh(refresh_token=refresh_token)

        self.client = QuickBooks(
            auth_client=self.auth_client,
            refresh_token=refresh_token,
            company_id=realm_id
        )

    async def create_invoice(
        self,
        customer: Customer,
        line_items: list[LineItem],
        due_date: datetime
    ) -> str:
        """Create QuickBooks invoice"""

        from quickbooks.objects.invoice import Invoice
        from quickbooks.objects.detailline import SalesItemLine

        invoice = Invoice()
        invoice.CustomerRef = customer.quickbooks_id
        invoice.DueDate = due_date.strftime("%Y-%m-%d")

        for item in line_items:
            line = SalesItemLine()
            line.Amount = float(item.amount)
            line.Description = item.description
            invoice.Line.append(line)

        invoice.save(qb=self.client)

        return invoice.Id

    async def create_payment(
        self,
        invoice_id: str,
        amount: Decimal,
        payment_date: datetime,
        payment_method: str
    ) -> str:
        """Record payment in QuickBooks"""

        from quickbooks.objects.payment import Payment

        payment = Payment()
        payment.TotalAmt = float(amount)
        payment.TxnDate = payment_date.strftime("%Y-%m-%d")

        payment.Line = [
            {
                "Amount": float(amount),
                "LinkedTxn": [
                    {
                        "TxnId": invoice_id,
                        "TxnType": "Invoice"
                    }
                ]
            }
        ]

        payment.save(qb=self.client)

        return payment.Id

    async def sync_payment(
        self,
        agentpay_payment: OrchestrationPayment
    ) -> None:
        """Sync AgentPay payment to QuickBooks"""

        # Find or create customer
        customer = await self.find_or_create_customer(
            agentpay_payment.payer
        )

        # Create payment record
        await self.create_payment(
            invoice_id=agentpay_payment.external_invoice_id,
            amount=agentpay_payment.amount,
            payment_date=agentpay_payment.completed_at,
            payment_method=agentpay_payment.selected_rail
        )
```

#### Xero

```python
# server/polar/context_memory/accounting_sync/adapters/xero.py

from xero_python.api_client import ApiClient
from xero_python.accounting import AccountingApi

class XeroClient:
    """Integrate with Xero accounting"""

    async def sync_invoice(self, invoice: Invoice) -> str:
        """Create/update invoice in Xero"""

    async def sync_payment(self, payment: Payment) -> str:
        """Record payment in Xero"""
```

### 4. LLM & AI Services Integration

#### Anthropic Claude

```python
# server/polar/intent_recognition/classifiers/llm_classifier.py

from anthropic import AsyncAnthropic

class ClaudeIntentClassifier:
    """Use Claude for intent classification"""

    def __init__(self, api_key: str):
        self.client = AsyncAnthropic(api_key=api_key)

    async def classify(
        self,
        message: str,
        context: ConversationContext
    ) -> IntentResult:
        """Classify intent using Claude"""

        prompt = self._build_prompt(message, context)

        response = await self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0  # Deterministic for classification
        )

        # Parse structured output
        result = json.loads(response.content[0].text)

        return IntentResult(
            intent=TransactionIntent(result["intent"]),
            entities=ExtractedEntities(**result["entities"]),
            confidence=result["confidence"],
            explanation=result["explanation"]
        )

    def _build_prompt(
        self,
        message: str,
        context: ConversationContext
    ) -> str:
        """Build few-shot prompt for intent classification"""

        return f"""
You are a payment intent classifier. Analyze this message and extract transactional intent.

Message: "{message}"

Conversation context:
{self._format_context(context)}

Classify the intent and extract entities. Return JSON:

{{
  "intent": "payment_promise|invoice_request|payment_confirmation|split_request|approval|payment_inquiry|price_negotiation|none",
  "entities": {{
    "amount": 123.45,  // null if not mentioned
    "currency": "USD", // null if not mentioned
    "due_date": "2024-01-20T00:00:00Z", // ISO datetime, null if not mentioned
    "description": "..." // null if not mentioned
  }},
  "confidence": 0.95,  // 0-1
  "explanation": "Brief explanation of classification"
}}

Few-shot examples:
{self._get_few_shot_examples()}
"""
```

#### OpenAI GPT

```python
# Alternative LLM provider

from openai import AsyncOpenAI

class GPTIntentClassifier:
    """Use GPT for intent classification"""

    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

    async def classify(
        self,
        message: str,
        context: ConversationContext
    ) -> IntentResult:
        """Classify using GPT with structured outputs"""

        response = await self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {
                    "role": "system",
                    "content": "You are a payment intent classifier..."
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
            response_format={"type": "json_object"},
            temperature=0
        )

        result = json.loads(response.choices[0].message.content)
        return IntentResult(**result)
```

## Integration Testing Strategy

### Mock External Services

```python
# tests/mocks/pix_mock.py

class MockPIXClient(PIXClient):
    """Mock PIX client for testing"""

    def __init__(self):
        self.payments = {}

    async def create_qr_code(
        self,
        request: PIXPaymentRequest
    ) -> PIXQRCode:
        """Return mock QR code"""

        payment_id = str(uuid4())
        self.payments[payment_id] = {
            "status": "pending",
            "amount": request.amount
        }

        return PIXQRCode(
            payment_id=payment_id,
            qr_code_image="mock_base64_image",
            qr_code_text="00020126...mock",
            expires_at=datetime.now() + timedelta(minutes=15)
        )

    async def check_payment_status(
        self,
        payment_id: str
    ) -> PIXPaymentStatus:
        """Return mock status"""

        payment = self.payments.get(payment_id)
        return PIXPaymentStatus(
            payment_id=payment_id,
            status=payment["status"],
            completed_at=None
        )

    def simulate_payment_completion(self, payment_id: str):
        """Simulate payment completion for testing"""

        self.payments[payment_id]["status"] = "completed"
        self.payments[payment_id]["completed_at"] = datetime.now()
```

### Integration Test Example

```python
async def test_pix_payment_flow():
    """Test complete PIX payment flow"""

    # Use mock client
    pix_client = MockPIXClient()
    pix_adapter = PIXAdapter(pix_client)

    # Initiate payment
    response = await pix_adapter.initiate_payment(
        PaymentRequest(
            amount=Decimal("100"),
            currency="BRL",
            payer=User(tax_id="123.456.789-00"),
            payee=User(tax_id="987.654.321-00"),
            description="Test payment"
        )
    )

    assert response.status == PaymentStatus.PENDING
    assert response.qr_code is not None

    # Simulate payment completion
    pix_client.simulate_payment_completion(response.payment_id)

    # Check status
    status = await pix_adapter.check_status(response.payment_id)
    assert status == PaymentStatus.COMPLETED
```

## Environment Configuration

```bash
# .env configuration for integrations

# PIX
PIX_API_KEY=your_pix_api_key
PIX_SANDBOX=true

# Stripe (from Polar)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Wise
WISE_API_KEY=your_wise_api_key
WISE_SANDBOX=true

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=your_signing_secret

# QuickBooks
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=https://yourdomain.com/callback/quickbooks

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional)
OPENAI_API_KEY=sk-...
```

## Related Skills
- `payment-orchestration.md` - Use payment rail adapters
- `conversational-payments.md` - Use messaging adapters
- `intent-recognition.md` - Use LLM services

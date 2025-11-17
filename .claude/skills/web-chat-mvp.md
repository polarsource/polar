# Web Chat MVP Skill

## Purpose
Guide the development of AgentPay's Web Chat MVP - a conversational checkout widget embedded directly on your e-commerce site to validate the core hypothesis that conversational payments improve conversion.

## Context
This is a **focused MVP** (4 weeks) before building the full AgentPay platform (6 months). The goal is to prove users will buy inside a conversation on your own website, with minimal complexity.

**See**: `AGENTPAY_MVP_PLAN.md` for complete implementation roadmap

## Core Difference from Full AgentPay

| Aspect | Web Chat MVP | Full AgentPay |
|--------|--------------|---------------|
| Platform | Single (web widget) | Multi (WhatsApp, Slack, Telegram, Web) |
| Payment Rails | 1 (Stripe OR PIX) | 5+ (intelligent routing) |
| Scope | Your website only | Universal conversational payments |
| Timeline | 4 weeks | 6 months |
| Goal | Validate hypothesis | Production platform |

## Architecture Overview

```
Your Website
└── Product Page
    └── Chat Widget (React/Vue)
        ↓ WebSocket/API
    Backend (Python/Node.js)
    ├── Intent Recognition (OpenAI/Claude)
    ├── Product Lookup
    ├── Payment Service (Stripe or PIX)
    └── Webhook Handler
        ↓
    Payment Gateway
    └── Stripe OR PIX provider
```

## Component 1: Chat Widget (Frontend)

### Technology Choices

**Recommended**: React + TypeScript
- Most popular, great ecosystem
- Easy to embed as widget
- Build with Vite for fast development

**Alternative**: Vue
- Lighter, easier learning curve
- Good if your site is Vue-based

**Structure**:
```
chat-widget/
├── src/
│   ├── components/
│   │   ├── ChatWidget.tsx        # Main widget component
│   │   ├── ChatBubble.tsx        # Message bubble
│   │   ├── ChatInput.tsx         # Input field
│   │   ├── FloatingButton.tsx    # Floating chat button
│   │   ├── TypingIndicator.tsx   # "Agent is typing..."
│   │   ├── PaymentLink.tsx       # Payment button/link
│   │   └── TrustBadge.tsx        # Security indicators
│   ├── hooks/
│   │   ├── useChat.ts            # Chat logic
│   │   ├── useWebSocket.ts       # Real-time updates
│   │   └── useProductContext.ts  # Extract product from page
│   ├── types/
│   │   └── chat.ts               # TypeScript types
│   ├── api/
│   │   └── chatApi.ts            # API calls to backend
│   └── App.tsx
└── package.json
```

### Key Features

#### 1. Floating Button
```tsx
// FloatingButton.tsx
import React, { useState } from 'react';

export const FloatingButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all"
      aria-label="Open chat"
    >
      <MessageCircle size={24} />
    </button>
  );
};
```

#### 2. Chat Window
```tsx
// ChatWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { useChat } from '../hooks/useChat';

export const ChatWidget: React.FC = () => {
  const { messages, sendMessage, isTyping } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <h3 className="font-semibold">Chat with us</h3>
        <p className="text-sm text-blue-100">We're here to help!</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} />
    </div>
  );
};
```

#### 3. Product Context Injection
```tsx
// hooks/useProductContext.ts
import { useEffect, useState } from 'react';

export interface ProductContext {
  productId: string;
  productName: string;
  price: number;
  currency: string;
  imageUrl: string;
  variants?: {
    size?: string;
    color?: string;
    [key: string]: any;
  };
  inStock: boolean;
}

export const useProductContext = (): ProductContext | null => {
  const [context, setContext] = useState<ProductContext | null>(null);

  useEffect(() => {
    // Extract product data from page
    // Option 1: From data attributes
    const productElement = document.querySelector('[data-product-id]');
    if (productElement) {
      setContext({
        productId: productElement.getAttribute('data-product-id') || '',
        productName: productElement.getAttribute('data-product-name') || '',
        price: parseFloat(productElement.getAttribute('data-product-price') || '0'),
        currency: productElement.getAttribute('data-product-currency') || 'BRL',
        imageUrl: productElement.getAttribute('data-product-image') || '',
        inStock: productElement.getAttribute('data-in-stock') === 'true',
      });
    }

    // Option 2: From window object (if your site exposes it)
    if (window.productData) {
      setContext(window.productData);
    }

    // Option 3: From meta tags
    const productMeta = document.querySelector('meta[property="product:id"]');
    if (productMeta) {
      // Parse from meta tags
    }
  }, []);

  return context;
};
```

#### 4. Payment Link Component
```tsx
// PaymentLink.tsx
import React from 'react';
import { Lock, CreditCard, Zap } from 'lucide-react';

interface PaymentLinkProps {
  url: string;
  amount: number;
  currency: string;
  paymentMethod: 'stripe' | 'pix';
  onPaymentClick: () => void;
}

export const PaymentLink: React.FC<PaymentLinkProps> = ({
  url,
  amount,
  currency,
  paymentMethod,
  onPaymentClick
}) => {
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      {/* Trust Badge */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Lock size={16} className="text-green-600" />
        <span>Secure checkout</span>
      </div>

      {/* Amount */}
      <div className="text-2xl font-bold text-gray-900">
        {formatAmount(amount, currency)}
      </div>

      {/* Payment Method Info */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {paymentMethod === 'pix' ? (
          <>
            <Zap size={16} className="text-yellow-600" />
            <span>PIX - Instant payment, no fees</span>
          </>
        ) : (
          <>
            <CreditCard size={16} />
            <span>Visa, Mastercard, Apple Pay</span>
          </>
        )}
      </div>

      {/* Pay Button */}
      <button
        onClick={() => {
          onPaymentClick();
          window.open(url, '_blank');
        }}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Pay Now
      </button>

      {/* Privacy Note */}
      <p className="text-xs text-gray-500 text-center">
        Powered by {paymentMethod === 'pix' ? 'PIX' : 'Stripe'} • SSL Encrypted
      </p>
    </div>
  );
};
```

#### 5. WebSocket for Real-time Updates
```tsx
// hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (url: string, sessionId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    ws.current = new WebSocket(`${url}?session_id=${sessionId}`);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup
    return () => {
      ws.current?.close();
    };
  }, [url, sessionId]);

  const sendMessage = (message: any) => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, lastMessage, sendMessage };
};
```

### Embedding the Widget

```html
<!-- In your product page HTML -->
<div id="agentpay-chat-widget"></div>

<script src="https://your-cdn.com/agentpay-widget.js"></script>
<script>
  AgentPayChat.init({
    apiUrl: 'https://your-backend.com/api',
    productId: '{{product.id}}',
    productName: '{{product.name}}',
    productPrice: {{product.price}},
    currency: 'BRL',
  });
</script>
```

Or as a React component:
```tsx
// In your Next.js/React app
import { AgentPayWidget } from '@agentpay/widget';

export default function ProductPage({ product }) {
  return (
    <div>
      {/* Your product page content */}

      <AgentPayWidget
        productId={product.id}
        productName={product.name}
        productPrice={product.price}
        currency="BRL"
        apiUrl={process.env.NEXT_PUBLIC_AGENTPAY_API}
      />
    </div>
  );
}
```

## Component 2: Backend (Python/Node.js)

### Technology Choice

**Recommended**: Python + FastAPI
- Aligns with full AgentPay vision (Polar-based)
- Fast, async, great for APIs
- Easy AI/LLM integration
- Type hints and validation with Pydantic

**Alternative**: Node.js + Express
- JavaScript full-stack consistency
- Good ecosystem for real-time (Socket.IO)
- Faster initial MVP if team is JS-focused

### Backend Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # Configuration
│   ├── models.py                  # Data models
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py                # Chat endpoints
│   │   ├── webhooks.py            # Payment webhooks
│   │   └── admin.py               # Analytics/admin
│   ├── services/
│   │   ├── __init__.py
│   │   ├── intent_service.py      # Intent recognition
│   │   ├── product_service.py     # Product lookup
│   │   ├── payment_service.py     # Payment generation
│   │   └── conversation_service.py # Conversation management
│   ├── integrations/
│   │   ├── openai_client.py       # OpenAI integration
│   │   ├── stripe_client.py       # Stripe integration
│   │   └── pix_client.py          # PIX provider integration
│   └── utils/
│       ├── analytics.py           # Event tracking
│       └── websocket.py           # WebSocket manager
├── tests/
├── requirements.txt
└── Dockerfile
```

### Core Endpoints

#### 1. Chat Message Endpoint
```python
# app/api/chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.intent_service import IntentService
from app.services.conversation_service import ConversationService
from app.services.payment_service import PaymentService

router = APIRouter()

class ChatMessage(BaseModel):
    session_id: str
    message: str
    product_context: dict

class ChatResponse(BaseModel):
    message: str
    intent: str
    confidence: float
    payment_link: str | None = None
    action: str  # "none" | "payment" | "question_answered"

@router.post("/chat/message", response_model=ChatResponse)
async def send_message(request: ChatMessage):
    """Process chat message and return agent response"""

    # 1. Load conversation context
    conversation = await ConversationService.get_or_create(request.session_id)

    # 2. Detect intent
    intent_result = await IntentService.analyze(
        message=request.message,
        product_context=request.product_context,
        conversation_history=conversation.history
    )

    # 3. Generate response based on intent
    if intent_result.intent == "purchase_intent":
        # User wants to buy
        payment_link = await PaymentService.create_payment_link(
            product=request.product_context,
            session_id=request.session_id
        )

        response_message = f"""
        Great! Here's your secure checkout link for {request.product_context['name']}:

        Total: {format_currency(request.product_context['price'])}

        Click "Pay Now" to complete your purchase.
        """

        return ChatResponse(
            message=response_message,
            intent="purchase_intent",
            confidence=intent_result.confidence,
            payment_link=payment_link,
            action="payment"
        )

    elif intent_result.intent == "product_question":
        # User asking about product
        answer = await ProductService.answer_question(
            question=request.message,
            product=request.product_context
        )

        # Add soft purchase prompt
        answer += "\n\nWould you like to purchase this item?"

        return ChatResponse(
            message=answer,
            intent="product_question",
            confidence=intent_result.confidence,
            action="question_answered"
        )

    else:
        # General message
        response = await IntentService.generate_response(
            message=request.message,
            context=request.product_context
        )

        return ChatResponse(
            message=response,
            intent="general",
            confidence=intent_result.confidence,
            action="none"
        )
```

#### 2. Intent Recognition Service

**Option A: OpenAI Assistants** (Fastest MVP)
```python
# app/services/intent_service.py
import openai
from app.config import settings

openai.api_key = settings.OPENAI_API_KEY

class IntentService:
    @staticmethod
    async def analyze(message: str, product_context: dict, conversation_history: list):
        """Analyze user message for intent"""

        # Create assistant (or use existing one)
        assistant = await openai.beta.assistants.create(
            name="AgentPay Sales Assistant",
            instructions="""
            You are a helpful e-commerce sales assistant.

            Your goals:
            1. Answer product questions accurately
            2. Detect when user wants to buy
            3. Offer payment link when appropriate
            4. Be concise, friendly, and helpful

            When analyzing messages:
            - "buy", "purchase", "pay", "checkout", "yes" (after product question) = purchase_intent
            - Questions about product features, size, color, availability = product_question
            - Payment confirmation, order status = payment_inquiry
            - Everything else = general

            Return JSON with: intent, confidence, reasoning
            """,
            model="gpt-4-turbo-preview",
            tools=[{"type": "code_interpreter"}]
        )

        # Create thread with conversation history
        thread = await openai.beta.threads.create(
            messages=[
                {"role": "user", "content": f"Product context: {product_context}"},
                *conversation_history,
                {"role": "user", "content": message}
            ]
        )

        # Run assistant
        run = await openai.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant.id
        )

        # Wait for completion
        while run.status in ["queued", "in_progress"]:
            await asyncio.sleep(0.5)
            run = await openai.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )

        # Get response
        messages = await openai.beta.threads.messages.list(thread_id=thread.id)
        response = json.loads(messages.data[0].content[0].text.value)

        return IntentResult(
            intent=response["intent"],
            confidence=response["confidence"],
            reasoning=response.get("reasoning", "")
        )
```

**Option B: Anthropic Claude** (Better quality)
```python
# app/services/intent_service.py
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

class IntentService:
    @staticmethod
    async def analyze(message: str, product_context: dict, conversation_history: list):
        """Analyze user message for intent using Claude"""

        prompt = f"""
        You are analyzing a customer message in an e-commerce chat.

        Product context:
        {json.dumps(product_context, indent=2)}

        Conversation history:
        {json.dumps(conversation_history, indent=2)}

        Customer's latest message:
        "{message}"

        Analyze the intent and respond with JSON:
        {{
          "intent": "purchase_intent|product_question|payment_confirmation|general",
          "confidence": 0.0-1.0,
          "reasoning": "brief explanation",
          "suggested_response": "what to say to the customer"
        }}

        Intent definitions:
        - purchase_intent: User wants to buy (mentions: buy, purchase, pay, checkout, "yes" after product discussion)
        - product_question: Asking about features, size, color, stock, price
        - payment_confirmation: Confirming payment was made, asking about order status
        - general: Other messages

        Be accurate. High confidence (>0.9) only when very clear.
        """

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            temperature=0,  # Deterministic for classification
            messages=[{"role": "user", "content": prompt}]
        )

        result = json.loads(message.content[0].text)

        return IntentResult(**result)
```

**Option C: Hybrid (Recommended for MVP)**
```python
# app/services/intent_service.py
import re

class IntentService:
    # Rule-based patterns for obvious cases (fast path)
    PURCHASE_PATTERNS = [
        r'\b(buy|purchase|pay|checkout|order)\b',
        r'\b(yes|sure|ok|okay)\b',  # After product question
        r'\b(i want|i\'ll take|give me)\b'
    ]

    PRODUCT_QUESTION_PATTERNS = [
        r'\b(size|color|stock|available|have)\b',
        r'\b(material|fabric|made of)\b',
        r'\b(shipping|delivery|how long)\b',
        r'\b(price|cost|how much)\b'
    ]

    @staticmethod
    async def analyze(message: str, product_context: dict, conversation_history: list):
        """Hybrid intent classification: rules + LLM"""

        message_lower = message.lower()

        # Fast path: Rule-based for obvious patterns
        for pattern in IntentService.PURCHASE_PATTERNS:
            if re.search(pattern, message_lower, re.IGNORECASE):
                # High confidence purchase intent
                return IntentResult(
                    intent="purchase_intent",
                    confidence=0.95,
                    reasoning="Matched purchase keyword pattern"
                )

        for pattern in IntentService.PRODUCT_QUESTION_PATTERNS:
            if re.search(pattern, message_lower, re.IGNORECASE):
                return IntentResult(
                    intent="product_question",
                    confidence=0.9,
                    reasoning="Matched product question pattern"
                )

        # Slow path: LLM for ambiguous cases
        return await IntentService._llm_classify(message, product_context, conversation_history)

    @staticmethod
    async def _llm_classify(message: str, product_context: dict, conversation_history: list):
        """Use LLM for ambiguous cases"""
        # Use OpenAI or Claude as shown above
        pass
```

#### 3. Payment Service

**Stripe Implementation**:
```python
# app/services/payment_service.py
import stripe
from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

class PaymentService:
    @staticmethod
    async def create_payment_link(product: dict, session_id: str):
        """Create Stripe Checkout Session"""

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': product.get('currency', 'brl').lower(),
                        'unit_amount': int(product['price'] * 100),  # Convert to cents
                        'product_data': {
                            'name': product['name'],
                            'description': product.get('description', ''),
                            'images': [product.get('image_url', '')],
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{settings.FRONTEND_URL}/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/cancel",
                metadata={
                    'chat_session_id': session_id,
                    'product_id': product['id'],
                    'product_name': product['name'],
                },
                expires_at=int(time.time()) + 1800,  # 30 minutes
            )

            return session.url

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {e}")
            raise HTTPException(status_code=500, detail="Payment link creation failed")
```

**PIX Implementation**:
```python
# app/services/payment_service.py
import httpx
from app.config import settings

class PIXPaymentService:
    @staticmethod
    async def create_payment_link(product: dict, session_id: str):
        """Generate PIX QR code via Asaas/Gerencianet"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.PIX_API_URL}/v1/charges",
                headers={
                    "Authorization": f"Bearer {settings.PIX_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "value": float(product['price']),
                    "description": product['name'],
                    "expiresIn": 900,  # 15 minutes
                    "metadata": {
                        "chat_session_id": session_id,
                        "product_id": product['id']
                    }
                }
            )

            data = response.json()

            # Store charge for webhook lookup
            await PIXChargeRepository.create(
                charge_id=data['id'],
                session_id=session_id,
                product_id=product['id'],
                amount=product['price']
            )

            return {
                "qr_code_image": data['qrcode_image_url'],
                "qr_code_text": data['qrcode'],
                "charge_id": data['id']
            }
```

#### 4. Webhook Handlers

**Stripe Webhook**:
```python
# app/api/webhooks.py
from fastapi import APIRouter, Request, HTTPException
import stripe
from app.services.conversation_service import ConversationService
from app.utils.websocket import WebSocketManager

router = APIRouter()

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe payment confirmation"""

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle checkout.session.completed
    if event.type == "checkout.session.completed":
        session = event.data.object

        # Get chat session from metadata
        chat_session_id = session.metadata.chat_session_id
        product_name = session.metadata.product_name

        # Send confirmation message to chat
        confirmation_message = f"""
        Payment confirmed! 🎉

        Order #{session.id[:8]}
        {product_name}

        You'll receive a confirmation email shortly.
        """

        # Send via WebSocket if connected
        await WebSocketManager.send_message(
            session_id=chat_session_id,
            message=confirmation_message,
            message_type="payment_confirmation"
        )

        # Store in conversation history
        await ConversationService.add_message(
            session_id=chat_session_id,
            role="assistant",
            message=confirmation_message
        )

        # Create order in your system
        await OrderService.create_order(
            stripe_session_id=session.id,
            product_id=session.metadata.product_id,
            customer_email=session.customer_details.email
        )

        # Track analytics
        await AnalyticsService.track_event(
            event_name="payment_completed",
            session_id=chat_session_id,
            properties={
                "product_id": session.metadata.product_id,
                "amount": session.amount_total / 100,
                "currency": session.currency
            }
        )

    return {"status": "success"}
```

**PIX Webhook**:
```python
@router.post("/webhooks/pix")
async def pix_webhook(request: Request):
    """Handle PIX payment confirmation"""

    payload = await request.json()

    # Verify signature (provider-specific)
    if not verify_pix_signature(request, payload):
        raise HTTPException(status_code=401, detail="Invalid signature")

    if payload.get("status") == "CONFIRMED":
        charge_id = payload["id"]

        # Look up charge
        charge = await PIXChargeRepository.get_by_charge_id(charge_id)
        if not charge:
            logger.warning(f"Unknown charge ID: {charge_id}")
            return {"status": "ok"}

        # Send confirmation to chat
        confirmation_message = """
        Pagamento confirmado! 🎉

        Seu pedido está sendo processado.
        Você receberá um email de confirmação em breve.
        """

        await WebSocketManager.send_message(
            session_id=charge.session_id,
            message=confirmation_message,
            message_type="payment_confirmation"
        )

        # Create order
        await OrderService.create_order(
            pix_charge_id=charge_id,
            product_id=charge.product_id,
            amount=charge.amount
        )

        # Track analytics
        await AnalyticsService.track_event(
            event_name="payment_completed",
            session_id=charge.session_id,
            properties={
                "product_id": charge.product_id,
                "amount": charge.amount,
                "payment_method": "pix"
            }
        )

    return {"status": "ok"}
```

## Component 3: Analytics & Tracking

### Key Events to Track

```python
# app/utils/analytics.py
from dataclasses import dataclass
from datetime import datetime
import httpx

@dataclass
class AnalyticsEvent:
    event_name: str
    session_id: str
    timestamp: datetime
    properties: dict

class AnalyticsService:
    """Track conversion funnel and user behavior"""

    # Define key events
    EVENTS = {
        "chat_opened": "User opened chat widget",
        "message_sent": "User sent a message",
        "intent_detected": "System detected user intent",
        "product_question_asked": "User asked about product",
        "purchase_intent_detected": "User showed purchase intent",
        "payment_link_generated": "Payment link created",
        "payment_link_clicked": "User clicked payment link",
        "payment_initiated": "Payment process started",
        "payment_completed": "Payment successful",
        "payment_failed": "Payment failed",
        "conversation_abandoned": "User left without completing"
    }

    @staticmethod
    async def track_event(event_name: str, session_id: str, properties: dict = None):
        """Track analytics event"""

        event = AnalyticsEvent(
            event_name=event_name,
            session_id=session_id,
            timestamp=datetime.utcnow(),
            properties=properties or {}
        )

        # Store in database
        await AnalyticsRepository.create_event(event)

        # Send to analytics service (Mixpanel, Segment, etc.)
        if settings.ANALYTICS_ENABLED:
            await AnalyticsService._send_to_analytics_service(event)

    @staticmethod
    async def get_conversion_funnel(start_date: datetime, end_date: datetime):
        """Calculate conversion funnel metrics"""

        events = await AnalyticsRepository.get_events_between(start_date, end_date)

        # Group by session
        sessions = {}
        for event in events:
            if event.session_id not in sessions:
                sessions[event.session_id] = []
            sessions[event.session_id].append(event)

        # Calculate funnel
        funnel = {
            "chat_opened": 0,
            "message_sent": 0,
            "purchase_intent_detected": 0,
            "payment_link_clicked": 0,
            "payment_completed": 0
        }

        for session_id, session_events in sessions.items():
            event_names = [e.event_name for e in session_events]

            if "chat_opened" in event_names:
                funnel["chat_opened"] += 1
            if "message_sent" in event_names:
                funnel["message_sent"] += 1
            if "purchase_intent_detected" in event_names:
                funnel["purchase_intent_detected"] += 1
            if "payment_link_clicked" in event_names:
                funnel["payment_link_clicked"] += 1
            if "payment_completed" in event_names:
                funnel["payment_completed"] += 1

        # Calculate conversion rates
        funnel["conversion_rate_chat_to_payment"] = (
            funnel["payment_completed"] / funnel["chat_opened"] * 100
            if funnel["chat_opened"] > 0 else 0
        )

        return funnel
```

### Conversion Funnel Visualization

```python
# app/api/admin.py
from fastapi import APIRouter
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/admin/analytics/funnel")
async def get_funnel_analytics(days: int = 7):
    """Get conversion funnel for last N days"""

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    funnel = await AnalyticsService.get_conversion_funnel(start_date, end_date)

    # Compare to baseline (standard checkout)
    baseline = await StandardCheckoutAnalytics.get_conversion_rate(start_date, end_date)

    return {
        "chat_funnel": funnel,
        "standard_checkout_conversion": baseline,
        "improvement": funnel["conversion_rate_chat_to_payment"] - baseline,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        }
    }
```

## Testing Strategy

### Unit Tests
```python
# tests/test_intent_service.py
import pytest
from app.services.intent_service import IntentService

class TestIntentService:
    @pytest.mark.asyncio
    async def test_purchase_intent_detection(self):
        """Test detection of obvious purchase intent"""

        result = await IntentService.analyze(
            message="I want to buy this",
            product_context={"id": "123", "name": "T-Shirt"},
            conversation_history=[]
        )

        assert result.intent == "purchase_intent"
        assert result.confidence > 0.8

    @pytest.mark.asyncio
    async def test_product_question_detection(self):
        """Test detection of product questions"""

        result = await IntentService.analyze(
            message="Do you have this in size L?",
            product_context={"id": "123", "name": "T-Shirt"},
            conversation_history=[]
        )

        assert result.intent == "product_question"
        assert result.confidence > 0.8
```

### Integration Tests
```python
# tests/test_chat_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_chat_to_payment_flow():
    """Test complete flow from chat message to payment link generation"""

    async with AsyncClient(app=app, base_url="http://test") as client:
        # 1. Send initial message
        response = await client.post("/api/chat/message", json={
            "session_id": "test_session_123",
            "message": "I want to buy this",
            "product_context": {
                "id": "prod_123",
                "name": "Test Product",
                "price": 99.90,
                "currency": "BRL"
            }
        })

        assert response.status_code == 200
        data = response.json()

        assert data["intent"] == "purchase_intent"
        assert data["payment_link"] is not None
        assert "Pay Now" in data["message"]

        # 2. Verify conversation stored
        conversation = await ConversationService.get("test_session_123")
        assert len(conversation.history) == 2  # User message + agent response

        # 3. Verify analytics event tracked
        events = await AnalyticsRepository.get_events_for_session("test_session_123")
        assert any(e.event_name == "purchase_intent_detected" for e in events)
```

### E2E Tests with Playwright
```typescript
// tests/e2e/chat-purchase-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete purchase via chat', async ({ page }) => {
  // 1. Go to product page
  await page.goto('/products/test-product');

  // 2. Open chat widget
  await page.click('[data-testid="chat-button"]');
  await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();

  // 3. Send message
  await page.fill('[data-testid="chat-input"]', 'I want to buy this');
  await page.click('[data-testid="chat-send"]');

  // 4. Wait for agent response
  await expect(page.locator('text=/payment link|checkout/i')).toBeVisible();

  // 5. Click payment button
  await page.click('[data-testid="payment-button"]');

  // 6. Verify Stripe checkout opened (in new tab)
  const [checkoutPage] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('[data-testid="payment-button"]')
  ]);

  await expect(checkoutPage).toHaveURL(/checkout\.stripe\.com/);
});
```

## Deployment

### Backend Deployment (Railway/Heroku/Fly.io)

**Example: Railway**
```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300

[[services]]
name = "web"
```

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Widget Deployment (Vercel/Netlify)

Build widget as standalone JS bundle:
```bash
# Build widget
npm run build

# Outputs to dist/agentpay-widget.js
# Deploy to CDN or Vercel
```

## Success Metrics Dashboard

Create simple dashboard to track:
```python
# app/api/admin.py
@router.get("/admin/dashboard")
async def get_dashboard_metrics():
    """Get key metrics for dashboard"""

    # Last 7 days
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)

    return {
        "overview": {
            "total_conversations": await ConversationService.count(start_date, end_date),
            "total_payments": await PaymentService.count_successful(start_date, end_date),
            "total_revenue": await PaymentService.sum_revenue(start_date, end_date),
            "avg_time_to_payment": await AnalyticsService.avg_time_to_payment(start_date, end_date)
        },
        "conversion": {
            "chat_to_payment": await AnalyticsService.conversion_rate("chat_opened", "payment_completed", start_date, end_date),
            "intent_to_payment": await AnalyticsService.conversion_rate("purchase_intent_detected", "payment_completed", start_date, end_date),
            "link_click_to_payment": await AnalyticsService.conversion_rate("payment_link_clicked", "payment_completed", start_date, end_date)
        },
        "comparison": {
            "standard_checkout_conversion": 2.5,  # Your baseline
            "chat_checkout_conversion": await AnalyticsService.get_chat_conversion_rate(start_date, end_date),
            "improvement_percentage": "calculated"
        },
        "top_products": await AnalyticsService.get_top_products_by_chat_sales(start_date, end_date, limit=10)
    }
```

## Next Steps After MVP

See `AGENTPAY_MVP_PLAN.md` for:
- Complete 4-week implementation timeline
- Go/No-Go decision criteria
- Scaling plan if successful
- Path to full AgentPay build

## Related Documents

- `AGENTPAY_MVP_PLAN.md` - Complete MVP implementation plan
- `AGENTPAY_IMPLEMENTATION_PLAN.md` - Full 6-month platform build
- `.claude/skills/payment-orchestration.md` - Payment rail patterns (for future)
- `.claude/skills/intent-recognition.md` - Advanced NLU patterns (for future)

---

**Remember**: The MVP goal is to **validate the hypothesis** that conversational checkout improves conversion. Keep it simple, ship fast, measure results, then decide whether to invest in the full build.

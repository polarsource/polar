# Agent Core Skill: The Brain of AgentPay

## Purpose
Build the intelligent decision-making system that powers conversational commerce - the "brain" that understands users, makes decisions, invokes tools, and generates trust-building responses.

## Context
The Agent Core is the most critical component of AgentPay. It sits between the chat interface (frontend) and the tools (payments, products, etc.), orchestrating the entire conversational commerce flow.

**For MVP**: Simple, rule-based decision logic with LLM assistance
**For Full Build**: Sophisticated ML models with context memory and learning

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT CORE                           │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. Conversation Understanding Layer            │    │
│  │     (LLM Intent Engine)                         │    │
│  │     - Detects user intent                       │    │
│  │     - Extracts entities                         │    │
│  │     - Identifies user stage                     │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  2. Context Enrichment Layer                    │    │
│  │     - Product context (from page)               │    │
│  │     - User context (session, history)           │    │
│  │     - Conversation context                      │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  3. Decision Layer (Action Selector)            │    │
│  │     - Rule-based action selection               │    │
│  │     - Confidence-based routing                  │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  4. Tool Invocation Layer                       │    │
│  │     - Payment link generation                   │    │
│  │     - Product lookup                            │    │
│  │     - Discount application (optional)           │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  5. Response Generation Layer                   │    │
│  │     - Conversational UX                         │    │
│  │     - Trust-building language                   │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  6. State Memory Layer                          │    │
│  │     - Session state management                  │    │
│  │     - Conversation history                      │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Conversation Understanding

### Purpose
Detect what the user wants, what stage they're in, and any confusion or hesitation signals.

### Intent Types

| Intent | Example Messages | Meaning |
|--------|------------------|---------|
| `product_query` | "Do you have size L?", "What colors?" | Asking about product |
| `purchase_intent` | "Yes, I want it", "Can I buy now?" | Ready to buy |
| `price_sensitivity` | "Too expensive…", "Any discount?" | Price concern |
| `uncertainty` | "I'm not sure…", "Let me think" | Hesitation |
| `payment_query` | "Do you accept PIX?", "What payment methods?" | Payment questions |
| `checkout_ready` | "Ok send me the link", "How do I pay?" | Ready for checkout |
| `payment_confirmation` | "I paid", "Payment sent" | Confirming payment |
| `general_question` | "When will it arrive?", "Return policy?" | General inquiry |

### Implementation: Intent Classifier

**Option 1: Rule-Based (Fast, Deterministic)**

```python
# server/polar/agent_core/intent_classifier.py
import re
from enum import Enum
from dataclasses import dataclass

class Intent(str, Enum):
    PRODUCT_QUERY = "product_query"
    PURCHASE_INTENT = "purchase_intent"
    PRICE_SENSITIVITY = "price_sensitivity"
    UNCERTAINTY = "uncertainty"
    PAYMENT_QUERY = "payment_query"
    CHECKOUT_READY = "checkout_ready"
    PAYMENT_CONFIRMATION = "payment_confirmation"
    GENERAL_QUESTION = "general_question"

@dataclass
class IntentResult:
    intent: Intent
    confidence: float
    entities: dict
    reasoning: str

class RuleBasedIntentClassifier:
    """Fast, deterministic intent classification using patterns"""

    # Intent patterns (case-insensitive)
    PATTERNS = {
        Intent.PURCHASE_INTENT: [
            r'\b(yes|sure|ok|okay|yeah)\b',
            r'\b(buy|purchase|take it|i want|i\'ll take)\b',
            r'\b(give me|sold|deal)\b'
        ],
        Intent.PRODUCT_QUERY: [
            r'\b(have|available|stock|size|color|variant)\b',
            r'\b(what|which|show me)\b',
            r'\b(material|fabric|made of)\b'
        ],
        Intent.PRICE_SENSITIVITY: [
            r'\b(expensive|too much|cheaper|discount|promo)\b',
            r'\b(price|cost|reduce|lower)\b'
        ],
        Intent.UNCERTAINTY: [
            r'\b(not sure|maybe|thinking|hesitant|doubt)\b',
            r'\b(let me|give me time)\b'
        ],
        Intent.PAYMENT_QUERY: [
            r'\b(payment|pay|pix|credit|card|stripe)\b',
            r'\b(accept|method|how do i)\b'
        ],
        Intent.CHECKOUT_READY: [
            r'\b(send link|checkout|pay now|payment link)\b',
            r'\b(ready|proceed|continue)\b'
        ],
        Intent.PAYMENT_CONFIRMATION: [
            r'\b(paid|sent payment|done|completed)\b',
            r'\b(transferred|sent)\b'
        ]
    }

    @classmethod
    def classify(cls, message: str, context: dict = None) -> IntentResult:
        """Classify intent using pattern matching"""

        message_lower = message.lower()
        matched_intents = []

        # Check each intent pattern
        for intent, patterns in cls.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    matched_intents.append(intent)
                    break

        # If multiple matches, use context to disambiguate
        if len(matched_intents) > 1:
            intent = cls._disambiguate(matched_intents, context)
        elif len(matched_intents) == 1:
            intent = matched_intents[0]
        else:
            intent = Intent.GENERAL_QUESTION

        # Extract entities
        entities = cls._extract_entities(message, intent)

        return IntentResult(
            intent=intent,
            confidence=0.9 if len(matched_intents) == 1 else 0.7,
            entities=entities,
            reasoning=f"Matched pattern for {intent}"
        )

    @classmethod
    def _disambiguate(cls, intents: list, context: dict) -> Intent:
        """Use context to choose between multiple intent matches"""

        # If user has already expressed purchase intent, "yes" means checkout ready
        if Intent.PURCHASE_INTENT in intents and Intent.CHECKOUT_READY in intents:
            if context and context.get('last_agent_action') == 'offer_purchase':
                return Intent.CHECKOUT_READY
            return Intent.PURCHASE_INTENT

        # Default to first match
        return intents[0]

    @classmethod
    def _extract_entities(cls, message: str, intent: Intent) -> dict:
        """Extract entities from message"""

        entities = {}

        # Extract size
        size_match = re.search(r'\b(size|tamanho)\s*(xxs|xs|s|m|l|xl|xxl|p|m|g|gg|\d+)\b', message, re.IGNORECASE)
        if size_match:
            entities['size'] = size_match.group(2).upper()

        # Extract color
        color_match = re.search(r'\b(black|white|red|blue|green|yellow|preto|branco|vermelho|azul)\b', message, re.IGNORECASE)
        if color_match:
            entities['color'] = color_match.group(1).capitalize()

        # Extract quantity
        qty_match = re.search(r'\b(\d+)\s*(units?|pieces?|unidades?)\b', message, re.IGNORECASE)
        if qty_match:
            entities['quantity'] = int(qty_match.group(1))

        return entities
```

**Option 2: LLM-Based (Flexible, Handles Nuance)**

```python
# server/polar/agent_core/intent_classifier.py
from anthropic import Anthropic
import json

class LLMIntentClassifier:
    """Use LLM for intent classification"""

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)

    async def classify(self, message: str, context: dict = None) -> IntentResult:
        """Classify intent using Claude"""

        prompt = f"""
You are analyzing a customer message in an e-commerce conversation.

Message: "{message}"

Context: {json.dumps(context, indent=2) if context else "None"}

Classify the customer's intent and extract entities. Return JSON:

{{
  "intent": "product_query|purchase_intent|price_sensitivity|uncertainty|payment_query|checkout_ready|payment_confirmation|general_question",
  "confidence": 0.0-1.0,
  "entities": {{
    "size": "S/M/L/XL/etc",
    "color": "color name",
    "quantity": 1,
    "any_other_relevant_info": "value"
  }},
  "reasoning": "brief explanation"
}}

Intent Definitions:
- product_query: Asking about product availability, features, variants
- purchase_intent: Wants to buy ("yes", "I'll take it", "buy")
- price_sensitivity: Concerned about price, asking for discounts
- uncertainty: Hesitant, unsure, needs time to decide
- payment_query: Asking about payment methods
- checkout_ready: Ready for payment link ("send link", "how do I pay")
- payment_confirmation: Saying they've paid
- general_question: Other questions (shipping, returns, etc.)

Context hints:
- If previous message offered purchase and user says "yes" → checkout_ready
- If discussing variants and user confirms choice → purchase_intent
"""

        response = await self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=512,
            temperature=0,  # Deterministic
            messages=[{"role": "user", "content": prompt}]
        )

        result = json.loads(response.content[0].text)

        return IntentResult(
            intent=Intent(result['intent']),
            confidence=result['confidence'],
            entities=result.get('entities', {}),
            reasoning=result.get('reasoning', '')
        )
```

**Option 3: Hybrid (Recommended for MVP)**

```python
# server/polar/agent_core/intent_classifier.py

class HybridIntentClassifier:
    """Combine rule-based and LLM for best of both worlds"""

    def __init__(self, llm_classifier: LLMIntentClassifier):
        self.rule_based = RuleBasedIntentClassifier()
        self.llm = llm_classifier

    async def classify(self, message: str, context: dict = None) -> IntentResult:
        """Hybrid classification: rules first, LLM for ambiguous cases"""

        # Try rule-based first (fast path)
        rule_result = self.rule_based.classify(message, context)

        # If high confidence, use rule-based result
        if rule_result.confidence >= 0.9:
            return rule_result

        # For low confidence or ambiguous cases, use LLM
        llm_result = await self.llm.classify(message, context)

        # If LLM has higher confidence, use it
        if llm_result.confidence > rule_result.confidence:
            return llm_result

        # Otherwise stick with rule-based
        return rule_result
```

### Model Output Example

```json
{
  "intent": "purchase_intent",
  "confidence": 0.92,
  "entities": {
    "size": "L",
    "color": "Black",
    "quantity": 1
  },
  "reasoning": "User expressed clear purchase intent with 'I'll take it'"
}
```

---

## Layer 2: Context Enrichment

### Purpose
Combine product context, user context, and conversation context to give the agent full situational awareness.

### Context Types

#### 1. Product Context (from page)

```python
# server/polar/agent_core/context_enrichment.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class ProductContext:
    product_id: str
    product_name: str
    price: float
    currency: str
    image_url: str
    variants: dict  # {"size": ["S", "M", "L"], "color": ["Black", "White"]}
    stock_status: str  # "in_stock", "low_stock", "out_of_stock"
    description: Optional[str] = None
    category: Optional[str] = None

    @classmethod
    def from_page_data(cls, page_data: dict):
        """Create from frontend page data"""
        return cls(
            product_id=page_data['productId'],
            product_name=page_data['productName'],
            price=float(page_data['price']),
            currency=page_data.get('currency', 'BRL'),
            image_url=page_data.get('imageUrl', ''),
            variants=page_data.get('variants', {}),
            stock_status=page_data.get('stockStatus', 'in_stock'),
            description=page_data.get('description'),
            category=page_data.get('category')
        )
```

#### 2. User Context

```python
@dataclass
class UserContext:
    session_id: str
    user_id: Optional[str]  # If logged in
    country: str
    device_type: str  # "mobile", "desktop", "tablet"
    is_returning_visitor: bool
    previous_purchases: list
    items_viewed_today: list
    current_page_url: str

    @classmethod
    async def from_session(cls, session_id: str, request):
        """Build user context from session and request"""

        # Get country from IP
        country = await get_country_from_ip(request.client.host)

        # Get device type from user agent
        device_type = detect_device_type(request.headers.get('user-agent'))

        # Check if returning visitor (from cookie or session)
        is_returning = await check_returning_visitor(session_id)

        return cls(
            session_id=session_id,
            user_id=None,  # For MVP, no login required
            country=country,
            device_type=device_type,
            is_returning_visitor=is_returning,
            previous_purchases=[],
            items_viewed_today=await get_items_viewed(session_id),
            current_page_url=request.headers.get('referer', '')
        )
```

#### 3. Conversation Context

```python
@dataclass
class ConversationContext:
    messages: list  # History of user + agent messages
    last_user_message: str
    last_agent_action: Optional[str]  # Last action taken by agent
    selected_variant: dict  # User's selected size/color
    payment_link_generated: bool
    payment_link_url: Optional[str]
    payment_link_expires_at: Optional[datetime]
    hesitation_signals: int  # Count of uncertainty expressions
    price_objections: int  # Count of price concerns

    @classmethod
    async def load(cls, session_id: str):
        """Load conversation context from storage"""

        state = await ConversationStateRepository.get(session_id)
        if not state:
            return cls(
                messages=[],
                last_user_message='',
                last_agent_action=None,
                selected_variant={},
                payment_link_generated=False,
                payment_link_url=None,
                payment_link_expires_at=None,
                hesitation_signals=0,
                price_objections=0
            )

        return cls(**state)
```

#### 4. Enriched Context (Combined)

```python
@dataclass
class EnrichedContext:
    """Combined context for agent decision making"""
    product: ProductContext
    user: UserContext
    conversation: ConversationContext
    timestamp: datetime

    def summary(self) -> str:
        """Generate human-readable summary for LLM prompts"""
        return f"""
Current Situation:
- User is on the {self.product.product_name} page (${self.product.price})
- Available variants: {self.product.variants}
- Stock status: {self.product.stock_status}
- User location: {self.user.country}
- Conversation stage: {self.conversation.last_agent_action or 'initial'}
- Selected variant: {self.conversation.selected_variant or 'none yet'}
- Payment link: {'Generated' if self.conversation.payment_link_generated else 'Not generated'}
- Hesitation level: {'High' if self.conversation.hesitation_signals > 2 else 'Low'}
        """.strip()
```

#### Context Enrichment Service

```python
class ContextEnrichmentService:
    """Enriches incoming messages with full context"""

    @staticmethod
    async def enrich(
        session_id: str,
        user_message: str,
        product_data: dict,
        request
    ) -> EnrichedContext:
        """Build enriched context from all sources"""

        # Load product context
        product_context = ProductContext.from_page_data(product_data)

        # Load user context
        user_context = await UserContext.from_session(session_id, request)

        # Load conversation context
        conversation_context = await ConversationContext.load(session_id)

        # Update conversation with new message
        conversation_context.messages.append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.utcnow()
        })
        conversation_context.last_user_message = user_message

        return EnrichedContext(
            product=product_context,
            user=user_context,
            conversation=conversation_context,
            timestamp=datetime.utcnow()
        )
```

---

## Layer 3: Decision Layer (Action Selector)

### Purpose
Decide what action to take based on intent and context. This is **rule-based** for reliability, not LLM-based.

### Action Types

```python
from enum import Enum

class Action(str, Enum):
    # Information actions
    RESPOND_PRODUCT_INFO = "respond_product_info"
    ASK_VARIANT = "ask_variant"
    EXPLAIN_SHIPPING = "explain_shipping"
    EXPLAIN_RETURNS = "explain_returns"

    # Purchase flow actions
    OFFER_PURCHASE = "offer_purchase"
    GENERATE_CHECKOUT = "generate_checkout"
    CONFIRM_VARIANT_SELECTION = "confirm_variant_selection"

    # Payment actions
    EXPLAIN_PAYMENT_METHODS = "explain_payment_methods"
    RESEND_PAYMENT_LINK = "resend_payment_link"
    CHECK_PAYMENT_STATUS = "check_payment_status"

    # Objection handling
    OFFER_SMALL_DISCOUNT = "offer_small_discount"
    REASSURE_VALUE = "reassure_value"
    ASK_CLARIFYING_QUESTION = "ask_clarifying_question"

    # Fallback
    FALLBACK_ANSWER = "fallback_answer"
    ESCALATE_TO_HUMAN = "escalate_to_human"
```

### Decision Logic

```python
class DecisionEngine:
    """Select action based on intent and context"""

    @staticmethod
    def select_action(
        intent_result: IntentResult,
        context: EnrichedContext
    ) -> Action:
        """Deterministic action selection"""

        intent = intent_result.intent
        entities = intent_result.entities

        # PURCHASE INTENT flow
        if intent == Intent.PURCHASE_INTENT:
            # If variant not selected, ask for it
            if not context.conversation.selected_variant:
                if context.product.variants:
                    return Action.ASK_VARIANT
                else:
                    # No variants, go straight to checkout
                    return Action.GENERATE_CHECKOUT

            # Variant selected, generate checkout
            return Action.GENERATE_CHECKOUT

        # PRODUCT QUERY flow
        elif intent == Intent.PRODUCT_QUERY:
            # Answer the question and soft-offer purchase
            return Action.RESPOND_PRODUCT_INFO

        # CHECKOUT READY flow
        elif intent == Intent.CHECKOUT_READY:
            # User is ready, generate payment link
            return Action.GENERATE_CHECKOUT

        # PAYMENT QUERY flow
        elif intent == Intent.PAYMENT_QUERY:
            return Action.EXPLAIN_PAYMENT_METHODS

        # PRICE SENSITIVITY flow
        elif intent == Intent.PRICE_SENSITIVITY:
            # For MVP: just reassure value
            # Future: offer small discount if configured
            return Action.REASSURE_VALUE

        # UNCERTAINTY flow
        elif intent == Intent.UNCERTAINTY:
            # Track hesitation
            context.conversation.hesitation_signals += 1

            # Ask what's holding them back
            return Action.ASK_CLARIFYING_QUESTION

        # PAYMENT CONFIRMATION flow
        elif intent == Intent.PAYMENT_CONFIRMATION:
            # Check actual payment status
            return Action.CHECK_PAYMENT_STATUS

        # GENERAL QUESTION flow
        elif intent == Intent.GENERAL_QUESTION:
            # Try to answer, fallback if can't
            return Action.FALLBACK_ANSWER

        # Default fallback
        return Action.FALLBACK_ANSWER

    @staticmethod
    def should_escalate(context: EnrichedContext) -> bool:
        """Determine if conversation should escalate to human"""

        # Escalate if too many hesitation signals
        if context.conversation.hesitation_signals > 3:
            return True

        # Escalate if payment failed multiple times
        if context.conversation.payment_attempts > 2:
            return True

        # Escalate if explicit request
        if "speak to human" in context.conversation.last_user_message.lower():
            return True

        return False
```

---

## Layer 4: Tool Invocation

### Purpose
Execute the selected action by calling appropriate tools (payment APIs, product database, etc.)

### Tool Registry

```python
from abc import ABC, abstractmethod

class Tool(ABC):
    """Abstract base for all tools"""

    @abstractmethod
    async def execute(self, context: EnrichedContext, params: dict) -> dict:
        """Execute the tool and return results"""
        pass

# Tool 1: Product Lookup
class ProductLookupTool(Tool):
    """Query product database for information"""

    async def execute(self, context: EnrichedContext, params: dict) -> dict:
        """Lookup product details"""

        product_id = context.product.product_id

        # For MVP: product data comes from page context
        # Future: query actual database
        return {
            "name": context.product.product_name,
            "price": context.product.price,
            "currency": context.product.currency,
            "variants": context.product.variants,
            "stock_status": context.product.stock_status,
            "description": context.product.description
        }

# Tool 2: Payment Link Generator
class PaymentLinkTool(Tool):
    """Generate Stripe or PIX payment link"""

    def __init__(self, payment_service):
        self.payment_service = payment_service

    async def execute(self, context: EnrichedContext, params: dict) -> dict:
        """Create payment link"""

        # Build line items
        line_items = [{
            "product_id": context.product.product_id,
            "name": context.product.product_name,
            "price": context.product.price,
            "currency": context.product.currency,
            "quantity": 1,
            "variant": context.conversation.selected_variant
        }]

        # Generate payment link
        result = await self.payment_service.create_payment_link(
            session_id=context.user.session_id,
            line_items=line_items
        )

        # Update conversation state
        await ConversationStateRepository.update(
            session_id=context.user.session_id,
            payment_link_generated=True,
            payment_link_url=result['url'],
            payment_link_expires_at=result['expires_at']
        )

        return {
            "payment_url": result['url'],
            "expires_at": result['expires_at'],
            "payment_methods": result['payment_methods']
        }

# Tool 3: Variant Selector
class VariantSelectorTool(Tool):
    """Update selected variant in conversation state"""

    async def execute(self, context: EnrichedContext, params: dict) -> dict:
        """Store selected variant"""

        variant = {
            "size": params.get('size'),
            "color": params.get('color')
        }

        await ConversationStateRepository.update(
            session_id=context.user.session_id,
            selected_variant=variant
        )

        return {"variant": variant}

# Tool 4: Shipping Calculator
class ShippingCalculatorTool(Tool):
    """Calculate shipping cost and time"""

    async def execute(self, context: EnrichedContext, params: dict) -> dict:
        """Calculate shipping"""

        # For MVP: simple hardcoded logic
        # Future: integrate with actual shipping API

        if context.user.country == "BR":
            return {
                "cost": 0,  # Free shipping in Brazil
                "currency": "BRL",
                "estimated_days": "3-5"
            }
        else:
            return {
                "cost": 15.00,
                "currency": "USD",
                "estimated_days": "7-14"
            }

# Tool Registry
class ToolRegistry:
    """Manage all available tools"""

    def __init__(self, payment_service):
        self.tools = {
            "product_lookup": ProductLookupTool(),
            "payment_link": PaymentLinkTool(payment_service),
            "variant_selector": VariantSelectorTool(),
            "shipping_calculator": ShippingCalculatorTool()
        }

    async def invoke(
        self,
        tool_name: str,
        context: EnrichedContext,
        params: dict = None
    ) -> dict:
        """Invoke a tool by name"""

        if tool_name not in self.tools:
            raise ValueError(f"Unknown tool: {tool_name}")

        return await self.tools[tool_name].execute(context, params or {})
```

---

## Layer 5: Response Generation

### Purpose
Generate conversational, trust-building responses based on the action taken and tool results.

### Response Templates

```python
class ResponseGenerator:
    """Generate human-like, trust-building responses"""

    # Response templates by action
    TEMPLATES = {
        Action.RESPOND_PRODUCT_INFO: """
{product_info}

Would you like to complete your purchase?
        """.strip(),

        Action.ASK_VARIANT: """
Great choice! This {product_name} is available in:

{variant_options}

Which would you prefer?
        """.strip(),

        Action.GENERATE_CHECKOUT: """
Perfect! Here's your secure checkout link for {product_name}:

💰 Total: {formatted_price}

{payment_link_button}

🔒 Secure checkout • {payment_methods}

I'll confirm your payment instantly.
        """.strip(),

        Action.EXPLAIN_PAYMENT_METHODS: """
We accept:

• 💳 Credit Cards (Visa, Mastercard, Amex)
• 📱 Apple Pay & Google Pay
• ⚡ PIX (instant, no fees - Brazil only)

All payments are 100% secure and encrypted.

Ready to proceed?
        """.strip(),

        Action.REASSURE_VALUE: """
I understand the price is a consideration. Here's what makes this worth it:

{value_proposition}

Plus, we offer free returns within 30 days if it's not perfect for you.

Would you like to proceed?
        """.strip(),

        Action.ASK_CLARIFYING_QUESTION: """
I'm here to help! What's on your mind?

I can answer questions about:
• Product details & sizing
• Shipping & delivery
• Payment options
• Returns & exchanges

What would be most helpful?
        """.strip()
    }

    @staticmethod
    def generate(
        action: Action,
        context: EnrichedContext,
        tool_results: dict = None
    ) -> str:
        """Generate response for given action"""

        template = ResponseGenerator.TEMPLATES.get(
            action,
            "I'm here to help! How can I assist you?"
        )

        # Fill template with context
        if action == Action.RESPOND_PRODUCT_INFO:
            product_info = f"{context.product.product_name} is available"
            if tool_results and 'stock_status' in tool_results:
                if tool_results['stock_status'] == 'in_stock':
                    product_info += " and in stock ✓"
                elif tool_results['stock_status'] == 'low_stock':
                    product_info += ", but selling fast!"
                else:
                    product_info = f"Sorry, {context.product.product_name} is currently out of stock."

            return template.format(product_info=product_info)

        elif action == Action.ASK_VARIANT:
            variant_options = ""
            if 'size' in context.product.variants:
                variant_options += "📏 Sizes: " + ", ".join(context.product.variants['size']) + "\n"
            if 'color' in context.product.variants:
                variant_options += "🎨 Colors: " + ", ".join(context.product.variants['color'])

            return template.format(
                product_name=context.product.product_name,
                variant_options=variant_options.strip()
            )

        elif action == Action.GENERATE_CHECKOUT:
            formatted_price = f"{context.product.currency} {context.product.price:,.2f}"

            payment_methods = []
            if context.user.country == "BR":
                payment_methods.append("PIX")
            payment_methods.extend(["Card", "Apple Pay"])

            return template.format(
                product_name=context.product.product_name,
                formatted_price=formatted_price,
                payment_link_button="👉 [Pay Now]",
                payment_methods=" • ".join(payment_methods)
            )

        elif action == Action.REASSURE_VALUE:
            # Build value proposition from product data
            value_points = [
                "✓ High-quality materials",
                "✓ Fast delivery (3-5 days)",
                "✓ 30-day money-back guarantee"
            ]
            if context.product.description:
                value_points.insert(0, f"✓ {context.product.description}")

            return template.format(
                value_proposition="\n".join(value_points)
            )

        # Default template rendering
        return template

    @staticmethod
    def add_trust_signals(response: str, action: Action) -> str:
        """Add trust-building elements to response"""

        # For checkout actions, emphasize security
        if action == Action.GENERATE_CHECKOUT:
            if "🔒" not in response:
                response += "\n\n🔒 100% secure & encrypted"

        return response

    @staticmethod
    def adjust_tone(
        response: str,
        context: EnrichedContext
    ) -> str:
        """Adjust tone based on context"""

        # If user has shown hesitation, be more reassuring
        if context.conversation.hesitation_signals > 1:
            response += "\n\nNo pressure! Take your time to decide. 😊"

        # If user has price objections, be empathetic
        if context.conversation.price_objections > 0:
            response = response.replace("Perfect!", "I understand.")

        return response
```

---

## Layer 6: State Memory

### Purpose
Maintain conversation state across messages for continuity.

### State Schema

```python
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

@dataclass
class ConversationState:
    """Complete conversation state"""

    # Session info
    session_id: str
    created_at: datetime
    last_activity: datetime

    # Product selection
    product_id: str
    product_name: str
    selected_variant: dict  # {"size": "L", "color": "Black"}

    # Payment state
    payment_link_generated: bool
    payment_link_url: Optional[str]
    payment_link_expires_at: Optional[datetime]
    payment_attempts: int
    payment_status: str  # "none", "pending", "completed", "failed"

    # Conversation tracking
    messages: list  # All user + agent messages
    last_user_message: str
    last_agent_action: Optional[str]
    hesitation_signals: int
    price_objections: int

    # Metadata
    user_country: str
    device_type: str

    def to_dict(self) -> dict:
        """Convert to dict for storage"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict):
        """Create from stored dict"""
        return cls(**data)
```

### State Storage (Redis)

```python
import json
import redis.asyncio as redis
from datetime import timedelta

class ConversationStateRepository:
    """Manage conversation state in Redis"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.ttl = timedelta(hours=24)  # State expires after 24h

    async def get(self, session_id: str) -> Optional[ConversationState]:
        """Retrieve conversation state"""

        key = f"conversation:{session_id}"
        data = await self.redis.get(key)

        if not data:
            return None

        return ConversationState.from_dict(json.loads(data))

    async def save(self, state: ConversationState) -> None:
        """Save conversation state"""

        key = f"conversation:{state.session_id}"
        data = json.dumps(state.to_dict(), default=str)

        await self.redis.setex(key, self.ttl, data)

    async def update(self, session_id: str, **kwargs) -> None:
        """Update specific fields"""

        state = await self.get(session_id)
        if not state:
            raise ValueError(f"No state found for session {session_id}")

        # Update fields
        for key, value in kwargs.items():
            if hasattr(state, key):
                setattr(state, key, value)

        # Update last activity
        state.last_activity = datetime.utcnow()

        await self.save(state)

    async def delete(self, session_id: str) -> None:
        """Delete conversation state"""

        key = f"conversation:{session_id}"
        await self.redis.delete(key)
```

---

## Putting It All Together: Agent Core Service

```python
class AgentCoreService:
    """Main service that orchestrates all layers"""

    def __init__(
        self,
        intent_classifier,
        tool_registry: ToolRegistry,
        state_repository: ConversationStateRepository
    ):
        self.intent_classifier = intent_classifier
        self.tools = tool_registry
        self.state = state_repository
        self.decision_engine = DecisionEngine()
        self.response_generator = ResponseGenerator()

    async def process_message(
        self,
        session_id: str,
        user_message: str,
        product_data: dict,
        request
    ) -> dict:
        """
        Process user message through all layers

        Returns:
        {
            "response": "Agent's message to user",
            "action": "action_taken",
            "payment_link": "url" (if applicable),
            "status": "success"
        }
        """

        # LAYER 2: Build enriched context
        context = await ContextEnrichmentService.enrich(
            session_id=session_id,
            user_message=user_message,
            product_data=product_data,
            request=request
        )

        # LAYER 1: Classify intent
        intent_result = await self.intent_classifier.classify(
            message=user_message,
            context={
                'last_agent_action': context.conversation.last_agent_action,
                'product': product_data
            }
        )

        # LAYER 3: Select action
        action = self.decision_engine.select_action(intent_result, context)

        # Check if should escalate
        if self.decision_engine.should_escalate(context):
            action = Action.ESCALATE_TO_HUMAN

        # LAYER 4: Invoke tools if needed
        tool_results = {}
        if action == Action.GENERATE_CHECKOUT:
            tool_results = await self.tools.invoke(
                "payment_link",
                context,
                {"variant": context.conversation.selected_variant}
            )
        elif action == Action.RESPOND_PRODUCT_INFO:
            tool_results = await self.tools.invoke("product_lookup", context)
        elif action == Action.ASK_VARIANT:
            # Extract variant from entities if user specified one
            if intent_result.entities.get('size') or intent_result.entities.get('color'):
                await self.tools.invoke(
                    "variant_selector",
                    context,
                    intent_result.entities
                )

        # LAYER 5: Generate response
        response_text = self.response_generator.generate(
            action=action,
            context=context,
            tool_results=tool_results
        )

        # Add trust signals
        response_text = self.response_generator.add_trust_signals(
            response_text,
            action
        )

        # Adjust tone
        response_text = self.response_generator.adjust_tone(
            response_text,
            context
        )

        # LAYER 6: Update state
        await self.state.update(
            session_id=session_id,
            last_user_message=user_message,
            last_agent_action=str(action),
            messages=context.conversation.messages + [{
                'role': 'assistant',
                'content': response_text,
                'action': str(action),
                'timestamp': datetime.utcnow()
            }]
        )

        # Return response
        return {
            "response": response_text,
            "action": str(action),
            "intent": str(intent_result.intent),
            "confidence": intent_result.confidence,
            "payment_link": tool_results.get('payment_url'),
            "status": "success"
        }
```

---

## API Endpoint Integration

```python
# app/api/chat.py
from fastapi import APIRouter, Depends, Request
from app.agent_core.service import AgentCoreService

router = APIRouter()

@router.post("/chat/message")
async def chat_message(
    request: Request,
    message_data: ChatMessageRequest,
    agent_core: AgentCoreService = Depends()
):
    """Process chat message through Agent Core"""

    result = await agent_core.process_message(
        session_id=message_data.session_id,
        user_message=message_data.message,
        product_data=message_data.product_context,
        request=request
    )

    return ChatMessageResponse(**result)
```

---

## Testing Strategy

```python
# tests/test_agent_core.py
import pytest

class TestAgentCore:
    """Test Agent Core end-to-end"""

    @pytest.mark.asyncio
    async def test_purchase_intent_flow(self, agent_core, mock_context):
        """Test user expressing purchase intent"""

        result = await agent_core.process_message(
            session_id="test_123",
            user_message="I'll take it",
            product_data={"productId": "1", "productName": "Test Product", "price": 99.90},
            request=mock_request()
        )

        assert result['intent'] == "purchase_intent"
        assert result['action'] in ["ask_variant", "generate_checkout"]
        assert "checkout" in result['response'].lower()

    @pytest.mark.asyncio
    async def test_product_question_flow(self, agent_core):
        """Test user asking about product"""

        result = await agent_core.process_message(
            session_id="test_124",
            user_message="Do you have size L?",
            product_data={"productId": "1", "variants": {"size": ["S", "M", "L"]}},
            request=mock_request()
        )

        assert result['intent'] == "product_query"
        assert "L" in result['response']
        assert "purchase" in result['response'].lower()

    @pytest.mark.asyncio
    async def test_payment_link_generation(self, agent_core):
        """Test payment link is generated correctly"""

        result = await agent_core.process_message(
            session_id="test_125",
            user_message="Send me the payment link",
            product_data={"productId": "1", "productName": "Test", "price": 100},
            request=mock_request()
        )

        assert result['action'] == "generate_checkout"
        assert result['payment_link'] is not None
        assert "secure" in result['response'].lower()
```

---

## Success Criteria

**For MVP**:
- ✅ Intent classification > 85% accuracy
- ✅ Action selection is deterministic and testable
- ✅ Payment links generated successfully
- ✅ Conversation state persists across messages
- ✅ Response tone is conversational and trust-building
- ✅ Handles 5+ core intents

**For Full Build**:
- Advanced ML models for intent
- Multi-turn reasoning
- Personalization based on history
- A/B testing of response templates
- Auto-learning from corrections

---

## Related Skills

- `web-chat-mvp.md` - Frontend integration
- `intent-recognition.md` - Advanced NLU patterns (full build)
- `conversational-payments.md` - Complex flow orchestration (full build)

---

**Remember**: The Agent Core is the brain. Keep it simple, deterministic, and testable for MVP. Add sophistication only after validating the core hypothesis.

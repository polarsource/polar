"""Intent classification - hybrid rule-based + LLM approach."""

import re
from typing import Any

from polar.agent.enums import Intent
from polar.agent.schemas import IntentResult


class IntentClassifier:
    """
    Hybrid intent classifier combining rule-based and LLM approaches.

    Strategy:
    1. Fast rule-based classification for common patterns (80% of cases)
    2. LLM fallback for complex/ambiguous cases
    3. Entity extraction from user message
    """

    # Rule-based patterns (fast path)
    PATTERNS = {
        Intent.GREETING: [
            r"^(hi|hello|hey|good morning|good afternoon|good evening)",
            r"^(hola|oi|salut|bonjour)",
        ],
        Intent.FAREWELL: [
            r"(bye|goodbye|see you|thanks|thank you|got it)",
            r"(that'?s all|no more|i'?m good)",
        ],
        Intent.PRODUCT_QUERY: [
            r"(looking for|searching for|find|show me|need|want)",
            r"(do you have|got any|sell|available)",
        ],
        Intent.PURCHASE_INTENT: [
            r"(i'?ll take|i want to buy|add to cart|buy now)",
            r"(purchase|get this|order)",
        ],
        Intent.CHECKOUT_READY: [
            r"(checkout|proceed|pay now|complete order)",
            r"(ready to buy|let'?s do this)",
        ],
        Intent.PRICE_QUERY: [
            r"(how much|what'?s the price|cost)",
            r"(price|pricing)",
        ],
        Intent.PRICE_NEGOTIATION: [
            r"(can you do|discount|cheaper|lower price)",
            r"(\$\d+|[0-9]+ dollars?|[0-9]+ bucks)",
        ],
        Intent.DISCOUNT_INQUIRY: [
            r"(coupon|promo code|discount code|sale)",
            r"(special offer|deal)",
        ],
        Intent.SHIPPING_QUESTION: [
            r"(shipping|delivery|ship|deliver)",
            r"(how long|when will|track)",
        ],
        Intent.RETURN_QUESTION: [
            r"(return|refund|send back|exchange)",
            r"(money back|cancel order)",
        ],
        Intent.PAYMENT_ISSUE: [
            r"(payment|card|credit card|pay)",
            r"(declined|failed|error)",
        ],
        Intent.UNCERTAINTY: [
            r"(maybe|not sure|thinking|hmm|umm)",
            r"(let me think|i don'?t know)",
        ],
        Intent.ESCALATION: [
            r"(human|person|representative|agent|manager)",
            r"(speak to someone|talk to)",
        ],
    }

    def __init__(self, llm_provider: str = "anthropic"):
        """Initialize intent classifier."""
        self.llm_provider = llm_provider
        # TODO: Initialize LLM client in Week 2-3
        self.llm_client = None

    async def classify(
        self,
        message: str,
        conversation_history: list[dict] | None = None,
        context: dict | None = None,
    ) -> IntentResult:
        """
        Classify customer intent from message.

        Args:
            message: User message text
            conversation_history: Recent messages for context
            context: Additional context (current product, cart, etc.)

        Returns:
            IntentResult with intent, confidence, and entities
        """
        message_lower = message.lower().strip()

        # 1. Try rule-based classification (fast)
        rule_result = self._classify_rules(message_lower)
        if rule_result and rule_result.confidence >= 0.8:
            return rule_result

        # 2. LLM classification (slower, more accurate)
        # TODO: Implement in Week 2-3 when LLM is integrated
        # For now, return rule result or default to UNKNOWN
        if rule_result:
            return rule_result

        # Default fallback
        return IntentResult(
            intent=Intent.UNKNOWN,
            confidence=0.3,
            entities={},
            reasoning="No clear pattern matched",
        )

    def _classify_rules(self, message: str) -> IntentResult | None:
        """Rule-based classification using regex patterns."""
        for intent, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, message, re.IGNORECASE):
                    # Extract entities
                    entities = self._extract_entities(message, intent)

                    return IntentResult(
                        intent=intent,
                        confidence=0.9,  # High confidence for rule match
                        entities=entities,
                        reasoning=f"Rule pattern matched: {pattern}",
                    )

        return None

    def _extract_entities(self, message: str, intent: Intent) -> dict[str, Any]:
        """Extract entities from message based on intent."""
        entities = {}

        # Price extraction
        price_match = re.search(r"\$?(\d+(?:\.\d{2})?)", message)
        if price_match and intent in (Intent.PRICE_NEGOTIATION, Intent.PRICE_QUERY):
            entities["proposed_price"] = int(float(price_match.group(1)) * 100)

        # Color extraction
        colors = ["blue", "red", "green", "black", "white", "yellow", "pink", "gray"]
        for color in colors:
            if color in message.lower():
                entities["color"] = color
                break

        # Size extraction
        sizes = ["xs", "s", "m", "l", "xl", "xxl", "small", "medium", "large"]
        for size in sizes:
            if re.search(rf"\b{size}\b", message.lower()):
                entities["size"] = size.upper() if len(size) <= 3 else size
                break

        # Quantity extraction
        qty_match = re.search(r"(\d+)\s*(pcs?|pieces?|items?)", message.lower())
        if qty_match:
            entities["quantity"] = int(qty_match.group(1))

        return entities

    async def classify_with_llm(
        self, message: str, conversation_history: list[dict], context: dict
    ) -> IntentResult:
        """
        LLM-based classification (fallback for complex cases).

        Uses Anthropic Claude Haiku for fast, cheap classification.
        """
        from polar.agent_llm.anthropic_client import AnthropicClient
        from polar.agent_llm.base import LLMMessage

        # Initialize Claude client
        claude = AnthropicClient()

        # Convert conversation history
        llm_history = [
            LLMMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
            for msg in conversation_history[-5:]  # Last 5 messages for context
        ]

        # Classify with LLM
        result = await claude.classify_intent(message, llm_history, context)

        # Convert to IntentResult
        try:
            intent = Intent(result["intent"])
        except ValueError:
            intent = Intent.UNKNOWN

        return IntentResult(
            intent=intent,
            confidence=result.get("confidence", 0.5),
            entities=result.get("entities", {}),
            reasoning="LLM classification",
        )


# Singleton instance
intent_classifier = IntentClassifier()

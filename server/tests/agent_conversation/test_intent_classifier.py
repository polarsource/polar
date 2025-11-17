"""Tests for intent classifier."""

import pytest

from polar.agent.enums import Intent
from polar.agent_conversation.intent_classifier import IntentClassifier, IntentResult


class TestIntentClassifier:
    """Test suite for IntentClassifier."""

    @pytest.fixture
    def classifier(self):
        """Create intent classifier instance."""
        return IntentClassifier()

    @pytest.mark.asyncio
    async def test_greeting_intent(self, classifier):
        """Test greeting intent detection."""
        result = await classifier.classify(
            message="Hello!",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.GREETING
        assert result.confidence >= 0.9
        assert "Rule pattern matched" in result.reasoning

    @pytest.mark.asyncio
    async def test_product_query_intent(self, classifier):
        """Test product query intent detection."""
        result = await classifier.classify(
            message="I'm looking for running shoes",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.PRODUCT_QUERY
        assert result.confidence >= 0.9

    @pytest.mark.asyncio
    async def test_price_negotiation_intent(self, classifier):
        """Test price negotiation intent detection."""
        result = await classifier.classify(
            message="Can you do $100 for these shoes?",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.PRICE_NEGOTIATION
        assert result.confidence >= 0.9
        # Should extract price entity
        assert "proposed_price" in result.entities
        assert result.entities["proposed_price"] == 10000  # $100 in cents

    @pytest.mark.asyncio
    async def test_purchase_intent(self, classifier):
        """Test purchase intent detection."""
        result = await classifier.classify(
            message="I'll take it, add to cart",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.PURCHASE_INTENT
        assert result.confidence >= 0.9

    @pytest.mark.asyncio
    async def test_checkout_ready_intent(self, classifier):
        """Test checkout ready intent detection."""
        result = await classifier.classify(
            message="Ready to checkout",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.CHECKOUT_READY
        assert result.confidence >= 0.9

    @pytest.mark.asyncio
    async def test_entity_extraction_color(self, classifier):
        """Test color entity extraction."""
        result = await classifier.classify(
            message="I want blue running shoes",
            conversation_history=[],
            context={},
        )

        assert result.intent == Intent.PRODUCT_QUERY
        assert "color" in result.entities
        assert result.entities["color"] == "blue"

    @pytest.mark.asyncio
    async def test_entity_extraction_size(self, classifier):
        """Test size entity extraction."""
        result = await classifier.classify(
            message="Do you have size L?",
            conversation_history=[],
            context={},
        )

        assert "size" in result.entities
        assert result.entities["size"] == "L"

    @pytest.mark.asyncio
    async def test_entity_extraction_quantity(self, classifier):
        """Test quantity entity extraction."""
        result = await classifier.classify(
            message="I need 3 pieces",
            conversation_history=[],
            context={},
        )

        assert "quantity" in result.entities
        assert result.entities["quantity"] == 3

    @pytest.mark.asyncio
    async def test_unknown_intent(self, classifier):
        """Test unknown intent fallback."""
        result = await classifier.classify(
            message="asdf qwer zxcv",  # Nonsensical message
            conversation_history=[],
            context={},
        )

        # Should either be UNKNOWN or fallback to LLM
        assert result.intent in (Intent.UNKNOWN, Intent.GENERAL_QUERY)

    @pytest.mark.asyncio
    async def test_context_awareness(self, classifier):
        """Test context awareness in classification."""
        result = await classifier.classify(
            message="That's expensive",
            conversation_history=[
                {"role": "user", "content": "Show me shoes"},
                {"role": "agent", "content": "Here are shoes for $200"},
            ],
            context={"cart": {"total": 20000}},
        )

        # Should detect price-related intent
        assert result.intent in (
            Intent.PRICE_QUERY,
            Intent.PRICE_NEGOTIATION,
            Intent.COMPLAINT,
        )

    def test_classify_rule_based_greeting(self, classifier):
        """Test rule-based classification for greeting."""
        result = classifier._classify_rule_based("Hello there!")

        assert result is not None
        assert result.intent == Intent.GREETING
        assert result.confidence == 0.9

    def test_classify_rule_based_product_query(self, classifier):
        """Test rule-based classification for product query."""
        result = classifier._classify_rule_based("looking for shoes")

        assert result is not None
        assert result.intent == Intent.PRODUCT_QUERY
        assert result.confidence == 0.9

    def test_classify_rule_based_no_match(self, classifier):
        """Test rule-based classification returns None when no match."""
        result = classifier._classify_rule_based("random text with no patterns")

        assert result is None

    def test_extract_entities_price(self, classifier):
        """Test price entity extraction."""
        entities = classifier._extract_entities(
            "Can you do $149.99?", Intent.PRICE_NEGOTIATION
        )

        assert "proposed_price" in entities
        assert entities["proposed_price"] == 14999  # In cents

    def test_extract_entities_multiple(self, classifier):
        """Test multiple entity extraction."""
        entities = classifier._extract_entities(
            "I need 2 blue shirts in size L for $50 each",
            Intent.PRODUCT_QUERY,
        )

        assert entities.get("color") == "blue"
        assert entities.get("size") == "L"
        assert entities.get("quantity") == 2

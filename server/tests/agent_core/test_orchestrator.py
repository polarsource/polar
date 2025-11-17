"""Tests for Agent Core orchestrator."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from polar.agent.enums import Action, Intent
from polar.agent_core.orchestrator import AgentOrchestrator
from polar.agent_llm.base import LLMResponse


class TestAgentOrchestrator:
    """Test suite for AgentOrchestrator."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator instance."""
        return AgentOrchestrator()

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.mark.asyncio
    async def test_understand_conversation(
        self, orchestrator, mock_session, conversation, user_message
    ):
        """Test Layer 1: Conversation Understanding."""
        with patch(
            "polar.agent.service.message_service.get_conversation_messages"
        ) as mock_get_messages:
            mock_get_messages.return_value = []

            result = await orchestrator._understand_conversation(
                mock_session, conversation, user_message
            )

            assert "intent" in result
            assert "entities" in result
            assert "confidence" in result
            assert "reasoning" in result
            assert isinstance(result["intent"], Intent)

    @pytest.mark.asyncio
    async def test_enrich_context(
        self, orchestrator, mock_session, conversation, user_message
    ):
        """Test Layer 2: Context Enrichment."""
        understanding = {
            "intent": Intent.PRODUCT_QUERY,
            "entities": {},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        with patch(
            "polar.agent.service.message_service.get_conversation_messages"
        ) as mock_get_messages:
            mock_get_messages.return_value = []

            result = await orchestrator._enrich_context(
                mock_session, conversation, understanding
            )

            assert "history" in result
            assert "customer_profile" in result
            assert "knowledge" in result
            assert "conversation_stage" in result
            assert "cart" in result
            assert "hesitation_signals" in result
            assert result["conversation_stage"] == "discovery"
            assert result["hesitation_signals"] == 0

    @pytest.mark.asyncio
    async def test_make_decision_product_query(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 3: Decision Engine for product query."""
        understanding = {
            "intent": Intent.PRODUCT_QUERY,
            "entities": {"product_type": "shoes", "max_price": 15000},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        enriched_context = {
            "history": [],
            "customer_profile": {},
            "knowledge": {},
            "conversation_stage": "discovery",
            "cart": {},
            "hesitation_signals": 0,
        }

        result = await orchestrator._make_decision(
            mock_session, conversation, understanding, enriched_context
        )

        assert result["action"] == Action.SEARCH_PRODUCTS
        assert "parameters" in result
        assert result["parameters"]["query"] == "shoes"
        assert result["parameters"]["max_price"] == 15000

    @pytest.mark.asyncio
    async def test_make_decision_checkout(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 3: Decision Engine for checkout."""
        understanding = {
            "intent": Intent.CHECKOUT_READY,
            "entities": {},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        enriched_context = {
            "history": [],
            "customer_profile": {},
            "knowledge": {},
            "conversation_stage": "consideration",
            "cart": {"items": [{"product_id": "123", "quantity": 1}], "total": 10000},
            "hesitation_signals": 0,
        }

        result = await orchestrator._make_decision(
            mock_session, conversation, understanding, enriched_context
        )

        assert result["action"] == Action.GENERATE_CHECKOUT
        assert "parameters" in result
        assert result["parameters"]["cart"]["total"] == 10000

    @pytest.mark.asyncio
    async def test_make_decision_price_negotiation(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 3: Decision Engine for price negotiation."""
        understanding = {
            "intent": Intent.PRICE_NEGOTIATION,
            "entities": {"proposed_price": 9000},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        enriched_context = {
            "history": [],
            "customer_profile": {},
            "knowledge": {},
            "conversation_stage": "consideration",
            "cart": {"total": 10000},
            "hesitation_signals": 2,
        }

        result = await orchestrator._make_decision(
            mock_session, conversation, understanding, enriched_context
        )

        assert result["action"] == Action.CALCULATE_OFFER
        assert result["parameters"]["cart_value"] == 10000
        assert result["parameters"]["hesitation_signals"] == 2
        assert result["parameters"]["proposed_price"] == 9000

    @pytest.mark.asyncio
    async def test_invoke_tools(self, orchestrator, mock_session):
        """Test Layer 4: Tool Invocation."""
        decision = {
            "action": Action.SEARCH_PRODUCTS,
            "parameters": {"query": "shoes", "max_price": 15000},
            "reasoning": "Test",
        }

        with patch(
            "polar.agent_tools.registry.tool_registry.invoke"
        ) as mock_invoke:
            from polar.agent_tools.base import ToolResult

            mock_invoke.return_value = ToolResult(
                success=True,
                data={"products": [{"id": "123", "name": "Test Shoes"}]},
                error=None,
                execution_time_ms=45,
            )

            result = await orchestrator._invoke_tools(mock_session, decision)

            assert len(result) == 1
            assert result[0]["tool"] == "product_lookup"
            assert result[0]["success"] is True
            assert result[0]["execution_time_ms"] == 45

    @pytest.mark.asyncio
    async def test_generate_response(
        self, orchestrator, mock_session, conversation, agent
    ):
        """Test Layer 5: Response Generation."""
        conversation.agent = agent

        understanding = {
            "intent": Intent.PRODUCT_QUERY,
            "entities": {},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        enriched_context = {
            "history": [],
            "customer_profile": {},
            "knowledge": {},
            "conversation_stage": "browsing",
            "cart": {},
            "hesitation_signals": 0,
        }

        decision = {
            "action": Action.SEARCH_PRODUCTS,
            "parameters": {},
            "reasoning": "Test",
        }

        tool_results = [
            {
                "tool": "product_lookup",
                "success": True,
                "data": {"products": [{"id": "123", "name": "Test Shoes"}]},
                "error": None,
                "execution_time_ms": 45,
            }
        ]

        with patch.object(
            orchestrator.llm_client, "chat", return_value=AsyncMock()
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="Here are some great running shoes...",
                role="assistant",
                finish_reason="stop",
            )

            result = await orchestrator._generate_response(
                mock_session,
                conversation,
                understanding,
                enriched_context,
                decision,
                tool_results,
            )

            assert isinstance(result, str)
            mock_chat.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_state_stage_transition(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 6: State Memory - stage transition."""
        understanding = {
            "intent": Intent.PRODUCT_QUERY,
            "entities": {},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        decision = {
            "action": Action.SEARCH_PRODUCTS,
            "parameters": {},
            "reasoning": "Test",
        }

        initial_stage = conversation.stage
        await orchestrator._update_state(
            mock_session, conversation, understanding, decision
        )

        # Stage should transition from discovery to browsing
        assert conversation.stage == "browsing"
        mock_session.add.assert_called_with(conversation)

    @pytest.mark.asyncio
    async def test_update_state_hesitation_tracking(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 6: State Memory - hesitation tracking."""
        understanding = {
            "intent": Intent.PRICE_NEGOTIATION,
            "entities": {"proposed_price": 9000},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        decision = {
            "action": Action.CALCULATE_OFFER,
            "parameters": {},
            "reasoning": "Test",
        }

        initial_hesitation = conversation.hesitation_signals
        await orchestrator._update_state(
            mock_session, conversation, understanding, decision
        )

        # Hesitation should increment
        assert conversation.hesitation_signals == initial_hesitation + 1

    @pytest.mark.asyncio
    async def test_update_state_negotiation_history(
        self, orchestrator, mock_session, conversation
    ):
        """Test Layer 6: State Memory - negotiation history."""
        understanding = {
            "intent": Intent.PRICE_NEGOTIATION,
            "entities": {"proposed_price": 9000},
            "confidence": 0.95,
            "reasoning": "Test",
        }

        decision = {
            "action": Action.CALCULATE_OFFER,
            "parameters": {},
            "reasoning": "Test",
        }

        await orchestrator._update_state(
            mock_session, conversation, understanding, decision
        )

        # Should add to negotiation history
        assert "negotiation_history" in conversation.context
        assert len(conversation.context["negotiation_history"]) == 1
        assert conversation.context["negotiation_history"][0]["intent"] == "price_negotiation"

    @pytest.mark.asyncio
    async def test_process_message_full_flow(
        self, orchestrator, mock_session, conversation, user_message, agent
    ):
        """Test complete message processing through all 6 layers."""
        conversation.agent = agent

        with patch.multiple(
            "polar.agent.service.message_service",
            get_conversation_messages=AsyncMock(return_value=[]),
            create_agent_message=AsyncMock(
                return_value=MagicMock(id="msg_123", content="Response")
            ),
        ), patch.object(
            orchestrator.llm_client, "chat", return_value=AsyncMock()
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="I'd be happy to help!",
                role="assistant",
                finish_reason="stop",
            )

            result = await orchestrator.process_message(
                mock_session, conversation, user_message
            )

            # Should return agent message
            assert result is not None
            mock_session.add.assert_called()  # State updated

    @pytest.mark.asyncio
    async def test_process_message_error_handling(
        self, orchestrator, mock_session, conversation, user_message, agent
    ):
        """Test error handling in message processing."""
        conversation.agent = agent

        with patch.object(
            orchestrator, "_understand_conversation", side_effect=Exception("Test error")
        ), patch(
            "polar.agent.service.message_service.create_agent_message",
            return_value=AsyncMock(),
        ):
            result = await orchestrator.process_message(
                mock_session, conversation, user_message
            )

            # Should return error response
            assert result is not None

    def test_build_system_prompt(self, orchestrator, agent):
        """Test system prompt building."""
        enriched_context = {
            "conversation_stage": "browsing",
            "hesitation_signals": 2,
        }

        prompt = orchestrator._build_system_prompt(agent, enriched_context)

        assert "friendly" in prompt  # Personality tone
        assert "15%" in prompt  # Max discount
        assert "browsing" in prompt  # Stage
        assert "2" in prompt  # Hesitation signals

    def test_format_tool_results(self, orchestrator):
        """Test tool results formatting."""
        tool_results = [
            {
                "tool": "product_lookup",
                "success": True,
                "data": {"products": [{"name": "Shoes"}]},
                "error": None,
            },
            {
                "tool": "discount_calculator",
                "success": False,
                "data": None,
                "error": "Calculation failed",
            },
        ]

        formatted = orchestrator._format_tool_results(tool_results)

        assert "product_lookup" in formatted
        assert "discount_calculator" in formatted
        assert "Calculation failed" in formatted

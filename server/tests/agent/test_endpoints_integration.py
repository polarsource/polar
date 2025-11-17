"""Integration tests for agent endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from polar.agent_llm.base import LLMResponse


class TestAgentEndpointsIntegration:
    """Integration tests for agent API endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_create_agent(self, client: AsyncClient, organization_id):
        """Test agent creation endpoint."""
        payload = {
            "organization_id": str(organization_id),
            "name": "Test Sales Agent",
            "agent_type": "sales",
            "personality": {
                "tone": "friendly",
                "verbosity": "medium",
            },
            "rules": {
                "max_discount_percent": 15,
            },
        }

        response = await client.post("/v1/agent/agents", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Sales Agent"
        assert data["agent_type"] == "sales"

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_create_conversation(self, client: AsyncClient, organization_id):
        """Test conversation creation endpoint."""
        payload = {
            "session_id": "test_session_123",
            "organization_id": str(organization_id),
        }

        response = await client.post("/v1/agent/conversations", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["session_id"] == "test_session_123"
        assert data["status"] == "active"
        assert data["stage"] == "discovery"

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_send_message_full_flow(
        self, client: AsyncClient, conversation
    ):
        """Test complete message flow through orchestrator."""
        with patch(
            "polar.agent_llm.anthropic_client.AnthropicClient.chat"
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="I'd be happy to help you find running shoes!",
                role="assistant",
                finish_reason="stop",
            )

            payload = {
                "content": "I'm looking for running shoes under $150",
                "context": {},
            }

            response = await client.post(
                f"/v1/agent/conversations/{conversation.id}/messages",
                json=payload,
            )

            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "conversation" in data
            assert data["message"]["role"] == "agent"
            assert data["message"]["content"] is not None

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_get_conversation_messages(
        self, client: AsyncClient, conversation
    ):
        """Test retrieving conversation message history."""
        response = await client.get(
            f"/v1/agent/conversations/{conversation.id}/messages"
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_get_conversation_by_session(
        self, client: AsyncClient, conversation
    ):
        """Test retrieving conversation by session ID."""
        response = await client.get(
            f"/v1/agent/conversations/session/{conversation.session_id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == conversation.session_id

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_conversation_not_found(self, client: AsyncClient):
        """Test 404 response for non-existent conversation."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await client.get(f"/v1/agent/conversations/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_intent_classification_in_message(
        self, client: AsyncClient, conversation
    ):
        """Test that intent is correctly classified in message flow."""
        with patch(
            "polar.agent_llm.anthropic_client.AnthropicClient.chat"
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="Ready for checkout!",
                role="assistant",
                finish_reason="stop",
            )

            payload = {
                "content": "I'm ready to buy this",
                "context": {},
            }

            response = await client.post(
                f"/v1/agent/conversations/{conversation.id}/messages",
                json=payload,
            )

            assert response.status_code == 200
            data = response.json()
            # Intent should be classified
            assert data["message"]["intent"] in ["purchase_intent", "checkout_ready"]

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_conversation_stage_progression(
        self, client: AsyncClient, conversation
    ):
        """Test that conversation stage progresses correctly."""
        with patch(
            "polar.agent_llm.anthropic_client.AnthropicClient.chat"
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="Great choice!",
                role="assistant",
                finish_reason="stop",
            )

            # Initial stage should be 'discovery'
            assert conversation.stage == "discovery"

            # Send product query - should move to 'browsing'
            payload = {"content": "Show me running shoes", "context": {}}
            response = await client.post(
                f"/v1/agent/conversations/{conversation.id}/messages",
                json=payload,
            )

            data = response.json()
            assert data["conversation"]["stage"] == "browsing"

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires database setup")
    async def test_hesitation_signal_tracking(
        self, client: AsyncClient, conversation
    ):
        """Test that hesitation signals are tracked."""
        with patch(
            "polar.agent_llm.anthropic_client.AnthropicClient.chat"
        ) as mock_chat:
            mock_chat.return_value = LLMResponse(
                content="Let me check what I can do...",
                role="assistant",
                finish_reason="stop",
            )

            initial_hesitation = conversation.hesitation_signals

            # Send price negotiation message
            payload = {
                "content": "That's too expensive, can you do $100?",
                "context": {},
            }
            response = await client.post(
                f"/v1/agent/conversations/{conversation.id}/messages",
                json=payload,
            )

            data = response.json()
            # Hesitation should increase
            assert (
                data["conversation"]["hesitation_signals"]
                > initial_hesitation
            )

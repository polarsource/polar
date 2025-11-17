"""Test configuration and fixtures for AgentPay tests."""

import pytest
from uuid import uuid4

from polar.models import Agent, Conversation, Message, Organization, Product


@pytest.fixture
def organization_id():
    """Return a test organization ID."""
    return uuid4()


@pytest.fixture
def agent(organization_id):
    """Create a test agent."""
    return Agent(
        id=uuid4(),
        organization_id=organization_id,
        name="Test Sales Agent",
        agent_type="sales",
        personality={
            "tone": "friendly",
            "verbosity": "medium",
            "emoji_usage": "moderate",
        },
        tools={
            "product_lookup": True,
            "payment_link": True,
            "discount_calculator": True,
        },
        rules={
            "max_discount_percent": 15,
            "allow_dynamic_pricing": True,
        },
        config={
            "llm_provider": "anthropic",
            "llm_model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1024,
            "temperature": 0.7,
        },
    )


@pytest.fixture
def conversation(agent):
    """Create a test conversation."""
    return Conversation(
        id=uuid4(),
        agent_id=agent.id,
        agent=agent,
        session_id=f"sess_{uuid4()}",
        status="active",
        stage="discovery",
        context={
            "cart": {},
            "preferences": {},
        },
        negotiation_history=[],
        hesitation_signals=0,
    )


@pytest.fixture
def user_message(conversation):
    """Create a test user message."""
    return Message(
        id=uuid4(),
        conversation_id=conversation.id,
        role="user",
        content="I'm looking for running shoes under $150",
        intent=None,
        entities={},
        tool_calls=[],
        attachments=[],
    )


@pytest.fixture
def product(organization_id):
    """Create a test product."""
    return Product(
        id=uuid4(),
        organization_id=organization_id,
        name="Nike Trail Runner Pro",
        description="Professional trail running shoes with excellent grip and durability",
        # Add other required fields based on Product model
    )


@pytest.fixture
def mock_llm_response():
    """Mock LLM response."""
    from polar.agent_llm.base import LLMResponse

    return LLMResponse(
        content="I'd be happy to help you find running shoes! Are you looking for trail or road running?",
        role="assistant",
        tool_calls=None,
        finish_reason="stop",
        usage={"input_tokens": 50, "output_tokens": 25},
    )


@pytest.fixture
def mock_embedding():
    """Mock embedding vector."""
    return [0.1] * 1536  # OpenAI text-embedding-3-small dimensions

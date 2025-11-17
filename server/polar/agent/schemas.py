"""Pydantic schemas for Agent Core API."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.agent.enums import Action, AgentType, Intent


# Agent schemas
class AgentBase(Schema):
    """Base agent schema."""

    name: str = Field(..., description="Agent name")
    agent_type: AgentType = Field(default=AgentType.SALES)
    personality: dict = Field(default_factory=dict)
    tools: dict = Field(default_factory=dict)
    rules: dict = Field(default_factory=dict)
    config: dict = Field(default_factory=dict)


class AgentCreate(AgentBase):
    """Create agent request."""

    organization_id: UUID


class AgentUpdate(Schema):
    """Update agent request."""

    name: str | None = None
    agent_type: AgentType | None = None
    personality: dict | None = None
    system_prompt: str | None = None
    tools: dict | None = None
    rules: dict | None = None
    config: dict | None = None
    status: str | None = None


class AgentPublic(AgentBase):
    """Public agent response."""

    id: UUID
    organization_id: UUID
    status: str
    created_at: datetime
    modified_at: datetime


# Conversation schemas
class ConversationBase(Schema):
    """Base conversation schema."""

    channel: str = Field(default="web")
    metadata: dict = Field(default_factory=dict)


class ConversationCreate(ConversationBase):
    """Create conversation request."""

    organization_id: UUID
    agent_id: UUID | None = None  # Auto-select if not provided
    customer_id: UUID | None = None  # Anonymous if not provided
    session_id: str = Field(..., description="Unique session identifier")


class ConversationPublic(ConversationBase):
    """Public conversation response."""

    id: UUID
    organization_id: UUID
    agent_id: UUID
    customer_id: UUID | None
    session_id: str
    status: str
    stage: str
    message_count: int
    customer_message_count: int
    agent_message_count: int
    hesitation_signals: int
    last_message_at: datetime | None
    last_intent: str | None
    context: dict
    agent_state: dict
    checkout_id: UUID | None
    order_id: UUID | None
    created_at: datetime
    modified_at: datetime


# Message schemas
class MessageBase(Schema):
    """Base message schema."""

    content: str = Field(..., description="Message text")


class MessageCreate(MessageBase):
    """Create message request (user sends message)."""

    context: dict = Field(
        default_factory=dict,
        description="Page context (url, referrer, etc.)",
    )


class MessagePublic(MessageBase):
    """Public message response."""

    id: UUID
    conversation_id: UUID
    role: str
    intent: str | None
    intent_confidence: float | None
    entities: dict
    action: str | None
    tool_calls: list
    attachments: list
    response_time_ms: int | None
    llm_provider: str | None
    llm_model: str | None
    created_at: datetime


# Agent response schema
class AgentResponse(Schema):
    """Agent response to user message."""

    message: MessagePublic
    """Agent's message"""

    conversation: ConversationPublic
    """Updated conversation state"""


# Intent classification result
class IntentResult(Schema):
    """Intent classification result."""

    intent: Intent
    confidence: float = Field(..., ge=0.0, le=1.0)
    entities: dict = Field(default_factory=dict)
    reasoning: str | None = None


# Action selection result
class ActionResult(Schema):
    """Action selection result."""

    action: Action
    parameters: dict = Field(default_factory=dict)
    reasoning: str | None = None


# Tool invocation result
class ToolResult(Schema):
    """Tool invocation result."""

    tool_name: str
    parameters: dict
    result: dict
    error: str | None = None
    execution_time_ms: int

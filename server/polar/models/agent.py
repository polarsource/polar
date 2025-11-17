"""Agent model - AI agent configuration for conversational commerce."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Conversation, Organization


class Agent(RecordModel):
    """
    AI agent configuration for an organization.

    Represents a conversational agent that can:
    - Understand customer intent
    - Search product catalog (RAG)
    - Negotiate prices
    - Generate checkout links
    - Handle support queries
    """

    __tablename__ = "agents"

    # Organization relationship (multi-tenant)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        lazy="raise",
    )

    # Agent configuration
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    """Human-readable name (e.g., 'Sales Agent', 'Support Agent')"""

    agent_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="sales"
    )
    """Agent type: 'sales', 'support', 'payment'"""

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )
    """Status: 'active', 'inactive', 'training'"""

    # Personality & behavior
    personality: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    """
    Agent personality configuration:
    {
        "tone": "friendly",  # friendly, professional, casual
        "verbosity": "medium",  # concise, medium, detailed
        "proactive": true,  # Suggest products proactively
        "greeting": "Hi! How can I help you today?"
    }
    """

    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    """Custom system prompt for LLM (overrides default)"""

    # Available tools
    tools: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Enabled tools for this agent:
    {
        "product_lookup": true,
        "payment_link": true,
        "discount_validator": true,
        "shipping_calculator": true,
        "inventory_checker": true
    }
    """

    # Business rules
    rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Business rules and constraints:
    {
        "max_discount_percent": 15,
        "require_approval_above": 15,
        "allow_dynamic_pricing": true,
        "price_bounds": {"min": 0.7, "max": 1.0},  # 70%-100% of base
        "auto_escalate_after_messages": 10
    }
    """

    # Configuration
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Additional configuration:
    {
        "llm_provider": "anthropic",  # anthropic, openai
        "llm_model": "claude-3-5-sonnet-20250219",
        "temperature": 0.7,
        "max_tokens": 500,
        "fallback_provider": "openai"
    }
    """

    # Metadata
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Additional metadata:
    {
        "created_by_user_id": "...",
        "last_trained_at": "2025-01-15T10:00:00Z",
        "performance_metrics": {...}
    }
    """

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="agent",
        lazy="raise",
    )

    # Timestamps inherited from RecordModel:
    # - created_at: datetime
    # - modified_at: datetime
    # - deleted_at: datetime | None (soft delete)

    def __repr__(self) -> str:
        return (
            f"Agent(id={self.id}, "
            f"name={self.name!r}, "
            f"type={self.agent_type!r}, "
            f"organization_id={self.organization_id})"
        )

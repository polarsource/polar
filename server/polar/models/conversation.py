"""Conversation model - Chat session between customer and agent."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Agent, Checkout, Customer, Message, Organization, Order


class Conversation(RecordModel):
    """
    Conversation session between a customer and an AI agent.

    Tracks the full conversational commerce flow:
    - Product discovery
    - Price negotiation
    - Checkout creation
    - Payment completion
    """

    __tablename__ = "conversations"

    # Organization (multi-tenant)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        lazy="raise",
    )

    # Agent handling this conversation
    agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent: Mapped["Agent"] = relationship(
        "Agent",
        back_populates="conversations",
        lazy="raise",
    )

    # Customer (optional - can be anonymous initially)
    customer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer: Mapped["Customer | None"] = relationship(
        "Customer",
        lazy="raise",
    )

    # Communication channel
    channel: Mapped[str] = mapped_column(
        String(50), nullable=False, default="web"
    )
    """Channel: 'web', 'whatsapp', 'telegram', 'sms', 'phone'"""

    # Session tracking
    session_id: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    """Unique session identifier (e.g., browser session, WhatsApp number)"""

    # Conversation state
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )
    """
    Status:
    - 'active': Ongoing conversation
    - 'paused': Customer went away
    - 'closed': Completed (order placed or abandoned)
    - 'escalated': Transferred to human agent
    """

    stage: Mapped[str] = mapped_column(
        String(50), nullable=False, default="discovery"
    )
    """
    Sales stage:
    - 'discovery': Learning customer needs
    - 'browsing': Showing products
    - 'interested': Customer engaged with products
    - 'negotiating': Price negotiation
    - 'checkout': Ready to buy
    - 'payment': Payment in progress
    - 'completed': Order placed
    """

    # Engagement metrics
    message_count: Mapped[int] = mapped_column(default=0)
    """Total messages in conversation (user + agent)"""

    customer_message_count: Mapped[int] = mapped_column(default=0)
    """Messages from customer"""

    agent_message_count: Mapped[int] = mapped_column(default=0)
    """Messages from agent"""

    hesitation_signals: Mapped[int] = mapped_column(default=0)
    """Count of hesitation signals detected (for dynamic pricing)"""

    # Last activity
    last_message_at: Mapped[datetime | None] = mapped_column(nullable=True)
    """Timestamp of last message"""

    last_customer_message_at: Mapped[datetime | None] = mapped_column(nullable=True)
    """Timestamp of last customer message"""

    # Intent & context
    last_intent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    """Last detected customer intent"""

    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Conversation context:
    {
        "current_product_id": "...",
        "selected_variant": {...},
        "cart_items": [...],
        "price_range": {"min": 0, "max": 10000},
        "preferences": {"color": "blue", "size": "M"},
        "page_url": "https://...",
        "referrer": "https://...",
        "utm_source": "google_ads"
    }
    """

    # Agent state
    agent_state: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Agent-specific state:
    {
        "last_action": "search_products",
        "tool_calls": [...],
        "products_shown": [...],
        "offers_made": [...],
        "questions_answered": [...]
    }
    """

    # Negotiation tracking
    negotiation_history: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list
    )
    """
    Price negotiation history:
    [
        {
            "timestamp": "2025-01-15T10:00:00Z",
            "type": "customer_proposal",
            "product_id": "...",
            "proposed_price": 8000,
            "base_price": 9500
        },
        {
            "timestamp": "2025-01-15T10:01:00Z",
            "type": "agent_counteroffer",
            "offered_price": 8500,
            "reasoning": "First purchase discount"
        }
    ]
    """

    # Summary
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    """AI-generated conversation summary (for merchant dashboard)"""

    # Outcomes
    checkout_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("checkouts.id", ondelete="SET NULL"),
        nullable=True,
    )
    checkout: Mapped["Checkout | None"] = relationship(
        "Checkout",
        lazy="raise",
    )

    order_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    order: Mapped["Order | None"] = relationship(
        "Order",
        lazy="raise",
    )

    # Metadata
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Additional metadata:
    {
        "device": "mobile",
        "browser": "Chrome",
        "location": {"country": "US", "region": "CA"},
        "language": "en",
        "timezone": "America/Los_Angeles"
    }
    """

    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        lazy="raise",
        order_by="Message.created_at",
    )

    # Timestamps inherited from RecordModel:
    # - created_at: datetime (conversation started)
    # - modified_at: datetime (last update)
    # - deleted_at: datetime | None (soft delete for GDPR compliance)

    def __repr__(self) -> str:
        return (
            f"Conversation(id={self.id}, "
            f"session_id={self.session_id!r}, "
            f"status={self.status!r}, "
            f"stage={self.stage!r}, "
            f"messages={self.message_count})"
        )

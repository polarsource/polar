"""Message model - Individual messages in a conversation."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Conversation


class Message(RecordModel):
    """
    Individual message in a conversation.

    Can be from:
    - user: Customer message
    - agent: AI agent response
    - system: System notifications (payment confirmed, order shipped, etc.)
    """

    __tablename__ = "messages"

    # Conversation relationship
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
        lazy="raise",
    )

    # Message metadata
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    """Role: 'user', 'agent', 'system'"""

    content: Mapped[str] = mapped_column(Text, nullable=False)
    """Message text content"""

    # Intent & classification (for user messages)
    intent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    """Detected intent: 'product_query', 'purchase_intent', 'price_negotiation', etc."""

    intent_confidence: Mapped[float | None] = mapped_column(nullable=True)
    """Intent classification confidence (0.0-1.0)"""

    entities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Extracted entities from user message:
    {
        "product_category": "dress",
        "color": "blue",
        "price_max": 10000,
        "size": "M",
        "quantity": 1
    }
    """

    # Action & tools (for agent messages)
    action: Mapped[str | None] = mapped_column(String(100), nullable=True)
    """Agent action taken: 'search_products', 'generate_checkout', 'calculate_offer'"""

    tool_calls: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    """
    Tools invoked for this response:
    [
        {
            "tool": "product_lookup",
            "parameters": {"query": "blue dress", "max_price": 10000},
            "result": {"products": [...]}
        },
        {
            "tool": "shipping_calculator",
            "parameters": {"zip_code": "94102"},
            "result": {"cost": 500, "days": 3}
        }
    ]
    """

    # Rich content
    attachments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    """
    Rich content attachments:
    [
        {
            "type": "product_card",
            "product_id": "...",
            "name": "Blue Summer Dress",
            "price": 9500,
            "image_url": "...",
            "action": "view_details"
        },
        {
            "type": "payment_button",
            "checkout_id": "...",
            "checkout_url": "...",
            "amount": 9500,
            "currency": "USD"
        },
        {
            "type": "image",
            "url": "...",
            "caption": "Product image"
        }
    ]
    """

    # Response metadata (for agent messages)
    response_time_ms: Mapped[int | None] = mapped_column(nullable=True)
    """Time taken to generate response (milliseconds)"""

    llm_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    """LLM provider used: 'anthropic', 'openai', 'template'"""

    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    """LLM model used: 'claude-3-5-sonnet-20250219', 'gpt-4', etc."""

    llm_tokens: Mapped[int | None] = mapped_column(nullable=True)
    """Tokens used (for cost tracking)"""

    # Metadata
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    """
    Additional metadata:
    {
        "edited": false,
        "deleted": false,
        "flagged": false,
        "feedback": {"helpful": true, "rating": 5},
        "context_used": ["product_catalog", "shipping_policy"],
        "confidence_score": 0.95
    }
    """

    # Timestamps inherited from RecordModel:
    # - created_at: datetime (message sent)
    # - modified_at: datetime (message edited)
    # - deleted_at: datetime | None (message deleted - soft delete)

    def __repr__(self) -> str:
        content_preview = (
            self.content[:50] + "..." if len(self.content) > 50 else self.content
        )
        return (
            f"Message(id={self.id}, "
            f"role={self.role!r}, "
            f"content={content_preview!r}, "
            f"intent={self.intent!r})"
        )

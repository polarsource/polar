from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.organization_agent_review import OrganizationAgentReview
    from polar.models.user import User


class OrganizationReviewFeedback(RecordModel):
    """Captures review decisions for organizations — both AI agent and human reviewer."""

    # --- Existing enums (kept for backward compat during expand phase) ---

    class AIVerdict(StrEnum):
        APPROVE = "APPROVE"
        DENY = "DENY"
        NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"

    class HumanVerdict(StrEnum):
        APPROVE = "APPROVE"
        DENY = "DENY"

    class Agreement(StrEnum):
        AGREE = "AGREE"
        OVERRIDE_TO_APPROVE = "OVERRIDE_TO_APPROVE"
        OVERRIDE_TO_DENY = "OVERRIDE_TO_DENY"

    # --- New enums ---

    class ActorType(StrEnum):
        AGENT = "agent"
        HUMAN = "human"

    class DecisionType(StrEnum):
        APPROVE = "APPROVE"
        DENY = "DENY"
        ESCALATE = "ESCALATE"

    __tablename__ = "organization_review_feedback"

    __table_args__ = (
        Index(
            "organization_review_feedback_one_current_per_org",
            "organization_id",
            unique=True,
            postgresql_where=text("is_current = true AND deleted_at IS NULL"),
        ),
    )

    # --- Existing columns (now nullable for agent decisions) ---

    agent_review_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organization_agent_reviews.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    reviewer_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    ai_verdict: Mapped[str | None] = mapped_column(String, nullable=True)
    human_verdict: Mapped[str | None] = mapped_column(String, nullable=True)
    agreement: Mapped[str | None] = mapped_column(String, nullable=True)

    override_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # --- New columns ---

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    actor_type: Mapped[str | None] = mapped_column(String, nullable=True)
    decision: Mapped[str | None] = mapped_column(String, nullable=True)
    verdict: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_context: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_current: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, server_default="false"
    )

    # --- Relationships ---

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def agent_review(cls) -> Mapped["OrganizationAgentReview"]:
        return relationship("OrganizationAgentReview", lazy="raise")

    @declared_attr
    def reviewer(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"OrganizationReviewFeedback(id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"actor_type={self.actor_type}, "
            f"decision={self.decision})"
        )

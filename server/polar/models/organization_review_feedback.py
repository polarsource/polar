from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
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

    # --- FK columns (nullable — not all decisions have both) ---

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

    # --- Decision columns ---

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

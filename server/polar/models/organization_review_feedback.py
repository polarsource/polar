from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization_agent_review import OrganizationAgentReview
    from polar.models.user import User


class OrganizationReviewFeedback(RecordModel):
    """Captures the relationship between an AI review verdict and a human reviewer's decision."""

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

    __tablename__ = "organization_review_feedback"

    agent_review_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organization_agent_reviews.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    reviewer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    ai_verdict: Mapped[AIVerdict] = mapped_column(String, nullable=False)
    human_verdict: Mapped[HumanVerdict] = mapped_column(String, nullable=False)
    agreement: Mapped[Agreement] = mapped_column(String, nullable=False)

    override_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    reviewed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

    @declared_attr
    def agent_review(cls) -> Mapped["OrganizationAgentReview"]:
        return relationship("OrganizationAgentReview", lazy="raise")

    @declared_attr
    def reviewer(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"OrganizationReviewFeedback(id={self.id}, "
            f"agent_review_id={self.agent_review_id}, "
            f"agreement={self.agreement})"
        )

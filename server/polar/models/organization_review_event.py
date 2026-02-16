from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal, NotRequired, TypedDict
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.user import User


class OrganizationReviewType(StrEnum):
    ONBOARDING = "onboarding"
    RISK_THRESHOLD = "risk_threshold"
    MANUAL = "manual"


class OrganizationReviewVerdict(StrEnum):
    APPROVED = "approved"
    DENIED = "denied"
    NEEDS_REVIEW = "needs_review"


class OrganizationReviewReason(StrEnum):
    AUTH_RATE = "auth_rate"
    REFUND_RATE = "refund_rate"
    RISK_SCORE = "risk_score"
    DISPUTE_RATE = "dispute_rate"
    CHARGEBACK_RATE = "chargeback_rate"


class OrganizationReviewDetails(TypedDict):
    reason: Literal[
        "auth_rate",
        "refund_rate",
        "risk_score",
        "dispute_rate",
        "chargeback_rate",
    ]
    value: float
    threshold: float
    window: Literal["30d"]
    payment_count: NotRequired[int]
    payment_attempt_count: NotRequired[int]
    refund_count: NotRequired[int]
    dispute_count: NotRequired[int]
    chargeback_count: NotRequired[int]


class OrganizationReviewEvent(RecordModel):
    """
    Model to log automated review events for organizations.

    Will be merged with `organization_reviews` once we do automated
    and ongoing reviews of submitted details and website against
    our AUP.

    However, we are keeping this separate for now at a first stage
    since `organization_review` is only for onboarding details
    and unique per organization at this stage.
    """

    __tablename__ = "organization_review_events"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    review_type: Mapped[OrganizationReviewType] = mapped_column(String, nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)

    verdict: Mapped[OrganizationReviewVerdict] = mapped_column(String, nullable=False)
    score: Mapped[float | None] = mapped_column(nullable=True)
    details: Mapped[OrganizationReviewDetails] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    resolved_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def resolved_by(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"OrganizationReviewEvent("
            f"id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"review_type={self.review_type}, "
            f"verdict={self.verdict})"
        )

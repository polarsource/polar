from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization


class OrganizationReview(RecordModel):
    """Model to store AI validation responses for organizations."""

    class Verdict(StrEnum):
        PASS = "PASS"
        FAIL = "FAIL"
        UNCERTAIN = "UNCERTAIN"

    class AppealDecision(StrEnum):
        APPROVED = "approved"
        REJECTED = "rejected"

    __tablename__ = "organization_reviews"
    __table_args__ = (
        # Partial unique index: at most one live (non-soft-deleted) review
        # per organization. Soft-deleted rows are allowed to coexist with
        # a new live row, so a re-review after cleanup can INSERT cleanly.
        Index(
            "ix_organization_reviews_organization_id",
            "organization_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    verdict: Mapped[Verdict] = mapped_column(String, nullable=False)
    risk_score: Mapped[float] = mapped_column(nullable=False)
    violated_sections: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    timed_out: Mapped[bool] = mapped_column(nullable=False, default=False)
    model_used: Mapped[str] = mapped_column(String, nullable=False)

    organization_details_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    validated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now()
    )

    # Appeal fields
    appeal_submitted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    appeal_reason: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    appeal_reviewed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    appeal_decision: Mapped[AppealDecision | None] = mapped_column(
        String, nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def clear_appeal_state(self) -> None:
        self.appeal_submitted_at = None
        self.appeal_reason = None
        self.appeal_reviewed_at = None
        self.appeal_decision = None

    @property
    def is_approved(self) -> bool:
        """Whether the review clears the merchant to operate.

        True when the verdict is PASS, or when a non-PASS verdict has been
        APPROVED on appeal by a human reviewer.
        """
        if self.verdict == self.Verdict.PASS:
            return True
        return self.appeal_decision == self.AppealDecision.APPROVED

    def __repr__(self) -> str:
        return f"OrganizationReview(id={self.id}, organization_id={self.organization_id}, verdict={self.verdict})"

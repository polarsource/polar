from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid, text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class InsightFeedbackAction(StrEnum):
    """How a merchant reacted to an insight."""

    dismiss = "dismiss"
    """The insight was acknowledged and hidden. Not a quality signal."""
    not_useful = "not_useful"
    """The insight was wrong or irrelevant. A negative quality signal."""


class InsightFeedback(RecordModel):
    """
    A merchant's reaction to a computed insight.

    Insights themselves are computed live (never persisted), so feedback is keyed
    by a *deterministic insight key* (`detector_id:organization_id:period_bucket`)
    rather than a foreign key. This lets a recomputed insight re-attach to the
    feedback a merchant already gave it, which is what powers dismissal and the
    "not useful" tuning signal.
    """

    __tablename__ = "insight_feedbacks"
    __table_args__ = (
        # One live feedback row per insight per organization: feedback writes
        # are idempotent (re-submitting updates the action), and the partial
        # predicate keeps soft-deleted rows from blocking a new one.
        Index(
            "ix_insight_feedbacks_org_key",
            "organization_id",
            "insight_key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    insight_key: Mapped[str] = mapped_column(String, nullable=False)
    """Deterministic key shared across recomputes of the same insight."""

    detector_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    """The detector that produced the insight. Denormalized for tuning analytics."""

    action: Mapped[InsightFeedbackAction] = mapped_column(
        StringEnum(InsightFeedbackAction), nullable=False
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

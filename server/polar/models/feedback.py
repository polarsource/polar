from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class FeedbackType(StrEnum):
    bug = "bug"
    feedback = "feedback"
    question = "question"


class FeedbackStatus(StrEnum):
    new = "new"
    triaged = "triaged"


class Feedback(RecordModel):
    __tablename__ = "feedbacks"
    __table_args__ = (
        Index("ix_feedbacks_status_created_at", "status", "created_at"),
        Index("ix_feedbacks_user_id_created_at", "user_id", "created_at"),
    )

    type: Mapped[FeedbackType] = mapped_column(String, nullable=False)
    status: Mapped[FeedbackStatus] = mapped_column(
        String, nullable=False, default=FeedbackStatus.new
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    client_context: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="restrict"),
        nullable=False,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

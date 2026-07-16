from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .subscription import Subscription


class SubscriptionPause(RecordModel):
    """A period during which a subscription was paused.

    A row is created when a pause takes effect and closed (`ended_at`) when the
    subscription resumes, so pause history remains queryable as intervals. At
    most one open pause exists per subscription.
    """

    __tablename__ = "subscription_pauses"
    __table_args__ = (
        Index(
            "ix_subscription_pauses_open_pause",
            "subscription_id",
            unique=True,
            postgresql_where="ended_at IS NULL AND deleted_at IS NULL",
        ),
    )

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise", back_populates="pauses")

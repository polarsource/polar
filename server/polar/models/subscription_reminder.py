from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum


class SubscriptionReminderType(StrEnum):
    renewal = "renewal"
    trial_conversion = "trial_conversion"


class SubscriptionReminder(RecordModel):
    __tablename__ = "subscription_reminders"

    __table_args__ = (
        UniqueConstraint(
            "subscription_id", "type", "target_date", name="subscription_reminders_unique"
        ),
    )

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    type: Mapped[SubscriptionReminderType] = mapped_column(
        StringEnum(SubscriptionReminderType), nullable=False
    )

    target_date: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

    sent_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

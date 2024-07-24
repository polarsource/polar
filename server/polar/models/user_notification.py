from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model


class UserNotification(Model):
    __tablename__ = "user_notifications"

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    last_read_notification_id: Mapped[UUID] = mapped_column(
        Uuid,
        nullable=True,
    )

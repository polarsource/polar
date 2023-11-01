from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model
from polar.kit.db.models.base import ModelMappedAsDataclass
from polar.kit.extensions.sqlalchemy import PostgresUUID


class UserNotification(ModelMappedAsDataclass, kw_only=True):
    __tablename__ = "user_notifications"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    last_read_notification_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        nullable=True,
    )

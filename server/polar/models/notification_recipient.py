from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .user import User


class NotificationRecipient(RecordModel):
    __tablename__ = "notification_recipients"
    __table_args__ = (
        Index(
            "ix_notification_recipients_expo_push_token",
            "user_id",
            "expo_push_token",
            "deleted_at",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade")
    )
    platform: Mapped[str] = mapped_column(String, nullable=False)
    expo_push_token: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise_on_sql")

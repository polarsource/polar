from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .user import User


class Device(RecordModel):
    __tablename__ = "devices"

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade")
    )
    platform: Mapped[str] = mapped_column(String, nullable=False)
    expo_push_token: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise_on_sql")

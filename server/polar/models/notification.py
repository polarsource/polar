from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.types import JSONDict

if TYPE_CHECKING:
    from polar.models import User


class Notification(RecordModel):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[JSONDict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped["User"] = relationship("User", lazy="raise")

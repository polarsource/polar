from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CHAR, ForeignKey, String, TIMESTAMP, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import User


class LoginCode(RecordModel):
    __tablename__ = "login_codes"

    code_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    user: Mapped["User | None"] = relationship("User", lazy="raise")
    
    return_to: Mapped[str | None] = mapped_column(String, nullable=True)
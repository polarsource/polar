from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

from .backoffice_user import BackofficeUser


class BackofficeUserSession(RecordModel):
    __tablename__ = "backoffice_user_sessions"

    token_hash: Mapped[str] = mapped_column(String(80), unique=True)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), index=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("backoffice_users.id", ondelete="cascade"), index=True
    )
    user: Mapped[BackofficeUser] = relationship(lazy="raise")

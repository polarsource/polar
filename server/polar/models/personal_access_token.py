from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class PersonalAccessToken(RecordModel):
    __tablename__ = "personal_access_tokens"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    user: Mapped[User] = relationship("User", foreign_keys=[user_id])

    last_used_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    comment: Mapped[str] = mapped_column(String, nullable=False)

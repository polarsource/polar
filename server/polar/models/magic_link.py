from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import utc_now
from polar.models.user import User


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.MAGIC_LINK_TTL_SECONDS)


class MagicLink(RecordModel):
    __tablename__ = "magic_links"

    token_hash: Mapped[str] = mapped_column(String, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=get_expires_at
    )

    user_email: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
    )
    user: Mapped["User | None"] = relationship("User")

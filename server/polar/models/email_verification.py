from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now
from polar.models.user import User


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.EMAIL_VERIFICATION_TTL_SECONDS)


class EmailVerification(RecordModel):
    __tablename__ = "email_verification"

    email: Mapped[str] = mapped_column(String, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=get_expires_at
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User)

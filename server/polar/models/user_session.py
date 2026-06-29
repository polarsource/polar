from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CHAR, TIMESTAMP, ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum
from polar.kit.utils import utc_now
from polar.models.user import User

if TYPE_CHECKING:
    from polar.models.user_session_organization import UserSessionOrganization


def get_expires_at() -> datetime:
    return utc_now() + settings.USER_SESSION_TTL


class UserSession(RecordModel):
    __tablename__ = "user_sessions"

    token: Mapped[str] = mapped_column(CHAR(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True, default=get_expires_at
    )
    user_agent: Mapped[str] = mapped_column(Text, nullable=False)
    scopes: Mapped[list[Scope]] = mapped_column(
        ARRAY(StringEnum(Scope)), nullable=False, default=list
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User, lazy="joined")

    @declared_attr
    def organization_scopes(cls) -> Mapped[list["UserSessionOrganization"]]:
        # Down-scope links (M2M). Eager-loaded so the auth middleware can read
        # the scope on every request without a lazy load. No rows means the
        # session is unrestricted.
        return relationship(
            "UserSessionOrganization",
            lazy="selectin",
            cascade="all, delete-orphan",
        )

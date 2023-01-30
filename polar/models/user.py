from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.ext.sqlalchemy import GUID
from polar.models.base import RecordModel


class OAuthAccount(RecordModel):
    __tablename__ = "oauth_accounts"

    oauth_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    access_token: Mapped[str] = mapped_column(String(1024), nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer)
    refresh_token: Mapped[str] = mapped_column(String(1024))
    account_id: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    account_email: Mapped[str] = mapped_column(String(320), nullable=False)

    @declared_attr
    def user_id(cls) -> Mapped[GUID]:
        return mapped_column(
            GUID, ForeignKey("users.id", ondelete="cascade"), nullable=False
        )


# username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
# avatar_url: Mapped[str] = mapped_column(String(255), nullable=False)
# company: Mapped[str] = mapped_column(String(255))
# location: Mapped[str] = mapped_column(String(255))
# bio: Mapped[str] = mapped_column(String(255))
# twitter: Mapped[str] = mapped_column(String(20))
# hireable: Mapped[str] = mapped_column(Boolean)
# public_email: Mapped[str] = mapped_column(Boolean)


class User(RecordModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    profile: Mapped[dict[str, Any]] = mapped_column(JSONB, default={})
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        OAuthAccount, lazy="joined"
    )

    __mutables__ = {
        # username,
        email,
        # avatar_url,
        # company,
        # location,
        # bio,
        # twitter,
        # hireable,
        # public_email,
    }

    def get_primary_oauth_account(self) -> OAuthAccount:
        return self.oauth_accounts[0]

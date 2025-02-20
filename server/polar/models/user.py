import time
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.schema import Index, UniqueConstraint

from polar.kit.db.models import RecordModel
from polar.kit.schemas import Schema

from .account import Account

if TYPE_CHECKING:
    pass


class OAuthPlatform(StrEnum):
    # maximum allowed length is 32 chars
    github = "github"
    github_repository_benefit = "github_repository_benefit"
    google = "google"


class OAuthAccount(RecordModel):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint(
            "platform",
            "account_id",
        ),
        Index("idx_user_id_platform", "user_id", "platform"),
    )

    platform: Mapped[OAuthPlatform] = mapped_column(String(32), nullable=False)
    access_token: Mapped[str] = mapped_column(String(1024), nullable=False)
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    refresh_token: Mapped[str | None] = mapped_column(
        String(1024), nullable=True, default=None
    )
    refresh_token_expires_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    account_id: Mapped[str] = mapped_column(String(320), nullable=False)
    account_email: Mapped[str] = mapped_column(String(320), nullable=False)
    account_username: Mapped[str | None] = mapped_column(String(320), nullable=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")

    def is_access_token_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at

    def should_refresh_access_token(self, unless_ttl_gt: int = 60 * 30) -> bool:
        if (
            self.expires_at
            and self.refresh_token
            and self.expires_at <= (time.time() + unless_ttl_gt)
        ):
            return True
        return False


class User(RecordModel):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "ix_users_email_case_insensitive", func.lower(Column("email")), unique=True
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def account(cls) -> Mapped[Account | None]:
        return relationship(
            Account,
            lazy="raise",
            back_populates="users",
            foreign_keys="[User.account_id]",
        )

    @declared_attr
    def oauth_accounts(cls) -> Mapped[list[OAuthAccount]]:
        return relationship(OAuthAccount, lazy="joined", back_populates="user")

    accepted_terms_of_service: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=True
    )

    # Time of blocking traffic/activity for given user
    blocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )

    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    @property
    def signup_attribution(self) -> dict[str, Any]:
        return self.meta.get("signup", {})

    @signup_attribution.setter
    def signup_attribution(self, value: dict[str, Any] | Schema | None) -> None:
        if not value:
            return

        meta = self.meta or {}
        if isinstance(value, Schema):
            value = value.model_dump(exclude_unset=True)

        meta["signup"] = value
        self.meta = meta

    @property
    def had_creator_signup_intent(self) -> bool:
        return self.signup_attribution.get("intent") == "creator"

    def get_oauth_account(self, platform: OAuthPlatform) -> OAuthAccount | None:
        return next(
            (
                account
                for account in self.oauth_accounts
                if account.platform == platform
            ),
            None,
        )

    def get_github_account(self) -> OAuthAccount | None:
        return self.get_oauth_account(OAuthPlatform.github)

    @property
    def posthog_distinct_id(self) -> str:
        return f"user:{self.id}"

    @property
    def public_name(self) -> str:
        github_oauth_account = self.get_github_account()
        if github_oauth_account is not None and github_oauth_account.account_username:
            return github_oauth_account.account_username
        return self.email[0]

    @property
    def github_username(self) -> str | None:
        github_oauth_account = self.get_github_account()
        if github_oauth_account is not None:
            return github_oauth_account.account_username
        return None

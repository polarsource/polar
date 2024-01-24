from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.schema import Index, UniqueConstraint

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

from .account import Account


class OAuthPlatform(StrEnum):
    github = "github"
    discord = "discord"


class OAuthAccount(RecordModel):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint(
            "platform",
            "account_id",
        ),
    )

    platform: Mapped[OAuthPlatform] = mapped_column(String(24), nullable=False)
    access_token: Mapped[str] = mapped_column(String(1024), nullable=False)
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    refresh_token: Mapped[str | None] = mapped_column(
        String(1024), nullable=True, default=None
    )
    account_id: Mapped[str] = mapped_column(String(320), nullable=False)
    account_email: Mapped[str] = mapped_column(String(320), nullable=False)
    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")


class User(RecordModel):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "ix_users_email_case_insensitive", func.lower(Column("email")), unique=True
        ),
    )

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    avatar_url: Mapped[str | None] = mapped_column(
        String(1024), nullable=True, default=None
    )

    profile: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, default=None, nullable=True, insert_default={}
    )

    account_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
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

    invite_only_approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    accepted_terms_of_service: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    last_seen_at_extension: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    last_version_extension: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        default=None,
    )

    email_newsletters_and_changelogs: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    email_promotions_and_events: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=True
    )

    def get_oauth_account(self, platform: OAuthPlatform) -> OAuthAccount | None:
        return next(
            (
                account
                for account in self.oauth_accounts
                if account.platform == platform
            ),
            None,
        )

    @property
    def posthog_distinct_id(self) -> str:
        return f"user:{self.id}"

    @property
    def public_name(self) -> str:
        github_oauth_account = self.get_oauth_account(OAuthPlatform.github)
        if github_oauth_account is not None:
            return self.username
        return self.email[0]

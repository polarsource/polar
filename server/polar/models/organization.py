from datetime import datetime
from enum import Enum
from typing import Any

from citext import CIText
from sqlalchemy import (
    TIMESTAMP,
    UUID,
    BigInteger,
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.enums import Platforms
from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum
from polar.kit.extensions.sqlalchemy.types import PostgresUUID

from .account import Account


class NotInstalledOrganization(PolarError):
    def __init__(self) -> None:
        super().__init__("This organization is not installed.")


class Organization(RecordModel):
    class Status(Enum):
        INACTIVE = "inactive"
        ACTIVE = "active"
        SUSPENDED = "suspended"

    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("name"),
        UniqueConstraint("external_id"),
        UniqueConstraint("installation_id"),
    )

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(CIText(), nullable=False, unique=True)
    external_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    avatar_url: Mapped[str] = mapped_column(String, nullable=False)
    is_personal: Mapped[bool] = mapped_column(Boolean, nullable=False)

    account_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def account(cls) -> Mapped[Account | None]:
        return relationship(Account, lazy="raise", back_populates="organizations")

    installation_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, unique=True
    )
    installation_created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    installation_updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    installation_suspended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )

    # This column is unused
    installation_suspended_by: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # This column is unused
    installation_suspender: Mapped[UUID | None] = mapped_column(
        PostgresUUID, nullable=True, default=None
    )

    # This colunm is never read.
    status: Mapped[Status] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.ACTIVE
    )

    # Whether to show pledged amount in the badge
    pledge_badge_show_amount: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    # Minimum amount required to pledge. Default to $20 (2000 cents)
    pledge_minimum_amount: Mapped[int] = mapped_column(
        Integer, nullable=False, default=settings.MINIMUM_ORG_PLEDGE_AMOUNT
    )

    default_badge_custom_content: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        default=None,
    )

    default_upfront_split_to_contributors: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    onboarded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    #
    # "Team" fields (org is pledger)
    #

    is_teams_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(length=50), nullable=True, unique=True, default=None
    )

    billing_email: Mapped[str | None] = mapped_column(
        String(length=120), nullable=True, default=None
    )

    total_monthly_spending_limit: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    per_user_monthly_spending_limit: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    custom_domain: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=True
    )

    profile_settings: Mapped[dict[str, Any]] = mapped_column(
        "profile_settings", JSONB, nullable=False, default=dict
    )

    #
    # Fields synced from GitHub
    #

    # Org description or user bio
    bio: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    pretty_name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    company: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    blog: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    location: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    email: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    twitter_username: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    #
    # End: Fields synced from GitHub
    #

    @property
    def polar_site_url(self) -> str:
        return f"{settings.FRONTEND_BASE_URL}/{self.name}"

    @property
    def account_url(self) -> str:
        if self.is_personal:
            return f"{settings.FRONTEND_BASE_URL}/finance/account"
        return f"{settings.FRONTEND_BASE_URL}/maintainer/{self.name}/finance/account"

    @property
    def safe_installation_id(self) -> int:
        if self.installation_id is None:
            raise NotInstalledOrganization()
        return self.installation_id

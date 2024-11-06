from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models import RecordModel

from .account import Account

if TYPE_CHECKING:
    from .product import Product


class Organization(RecordModel):
    __tablename__ = "organizations"
    __table_args__ = (UniqueConstraint("slug"),)

    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def account(cls) -> Mapped[Account | None]:
        return relationship(Account, lazy="raise", back_populates="organizations")

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

    # Time of blocking traffic/activity to given organization
    blocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )

    # If this organization was created from a GitHub User object, without installing
    # the Polar GitHub App.
    created_from_user_maintainer_upgrade: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

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

    profile_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    #
    # Feature Flags
    #

    feature_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    #
    # Fields synced from GitHub
    #

    # Org description or user bio
    bio: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
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

    @hybrid_property
    def storefront_enabled(self) -> bool:
        return self.profile_settings.get("enabled", False)

    @storefront_enabled.inplace.expression
    @classmethod
    def _storefront_enabled_expression(cls) -> ColumnElement[bool]:
        return Organization.profile_settings["enabled"].as_boolean()

    @property
    def polar_site_url(self) -> str:
        return f"{settings.FRONTEND_BASE_URL}/{self.slug}"

    @property
    def account_url(self) -> str:
        return f"{settings.FRONTEND_BASE_URL}/dashboard/{self.slug}/finance/account"

    @declared_attr
    def all_products(cls) -> Mapped[list["Product"]]:
        return relationship("Product", lazy="raise", back_populates="organization")

    @declared_attr
    def products(cls) -> Mapped[list["Product"]]:
        return relationship(
            "Product",
            lazy="raise",
            primaryjoin=(
                "and_("
                "Product.organization_id == Organization.id, "
                "Product.is_archived.is_(False)"
                ")"
            ),
            viewonly=True,
        )

from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.models import RecordModel

from .account import Account

if TYPE_CHECKING:
    from .product import Product


class OrganizationSocials(TypedDict):
    platform: str
    url: str


class OrganizationDetails(TypedDict):
    about: str
    product_description: str
    intended_use: str
    customer_acquisition: list[str]
    future_annual_revenue: int
    switching: bool
    switching_from: str | None
    previous_annual_revenue: int


class OrganizationSubscriptionSettings(TypedDict):
    allow_multiple_subscriptions: bool
    allow_customer_updates: bool
    proration_behavior: SubscriptionProrationBehavior


_default_subscription_settings: OrganizationSubscriptionSettings = {
    "allow_multiple_subscriptions": False,
    "allow_customer_updates": True,
    "proration_behavior": SubscriptionProrationBehavior.prorate,
}


class Organization(RecordModel):
    __tablename__ = "organizations"
    __table_args__ = (UniqueConstraint("slug"),)

    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    email: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    website: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    socials: Mapped[list[OrganizationSocials]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    details: Mapped[OrganizationDetails] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    details_submitted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True)
    )

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def account(cls) -> Mapped[Account | None]:
        return relationship(Account, lazy="raise", back_populates="organizations")

    onboarded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    # Time of blocking traffic/activity to given organization
    blocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )

    profile_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    subscription_settings: Mapped[OrganizationSubscriptionSettings] = mapped_column(
        JSONB, nullable=False, default=_default_subscription_settings
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

    @property
    def allow_multiple_subscriptions(self) -> bool:
        return self.subscription_settings["allow_multiple_subscriptions"]

    @property
    def allow_customer_updates(self) -> bool:
        return self.subscription_settings["allow_customer_updates"]

    @property
    def proration_behavior(self) -> SubscriptionProrationBehavior:
        return SubscriptionProrationBehavior(
            self.subscription_settings["proration_behavior"]
        )

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

    def is_blocked(self) -> bool:
        if self.blocked_at is not None:
            return True
        return False

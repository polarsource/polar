from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
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
from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

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


class OrganizationNotificationSettings(TypedDict):
    new_order: bool
    new_subscription: bool


_default_notification_settings: OrganizationNotificationSettings = {
    "new_order": True,
    "new_subscription": True,
}


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
    class Status(StrEnum):
        CREATED = "created"
        ONBOARDING_STARTED = "onboarding_started"
        UNDER_REVIEW = "under_review"
        DENIED = "denied"
        ACTIVE = "active"

        def get_display_name(self) -> str:
            return {
                Organization.Status.CREATED: "Created",
                Organization.Status.ONBOARDING_STARTED: "Onboarding Started",
                Organization.Status.UNDER_REVIEW: "Under Review",
                Organization.Status.DENIED: "Denied",
                Organization.Status.ACTIVE: "Active",
            }[self]

    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("slug"),
        CheckConstraint(
            "next_review_threshold >= 0", name="next_review_threshold_positive"
        ),
    )

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

    customer_invoice_prefix: Mapped[str] = mapped_column(String, nullable=False)
    customer_invoice_next_number: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="set null"), nullable=True
    )
    status: Mapped[Status] = mapped_column(
        StringEnum(Status),
        nullable=False,
        default=Status.CREATED,
    )
    next_review_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
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

    notification_settings: Mapped[OrganizationNotificationSettings] = mapped_column(
        JSONB, nullable=False, default=_default_notification_settings
    )

    #
    # Feature Flags
    #

    feature_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    subscriptions_billing_engine: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
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

    def is_under_review(self) -> bool:
        return self.status == Organization.Status.UNDER_REVIEW

    def is_active(self) -> bool:
        return self.status == Organization.Status.ACTIVE

    @property
    def statement_descriptor(self) -> str:
        return self.slug[: settings.stripe_descriptor_suffix_max_length]

    @property
    def statement_descriptor_prefixed(self) -> str:
        # Cannot use *. Setting separator to # instead.
        return f"{settings.STRIPE_STATEMENT_DESCRIPTOR}# {self.statement_descriptor}"

    def is_payment_ready(self) -> bool:
        """Check if organization can accept payments"""

        if self.is_blocked() or self.status == Organization.Status.DENIED:
            return False

        # If the organization was created before, we don't want to block payments.
        # Organizations created before Jul 30, 2025 are grandfathered in
        # Use timezone-aware comparison
        cutoff_date = datetime(2025, 7, 30, tzinfo=UTC)
        if self.created_at <= cutoff_date:
            return True

        # Organization must be ACTIVE or UNDER_REVIEW
        if self.status not in [
            Organization.Status.ACTIVE,
            Organization.Status.UNDER_REVIEW,
        ]:
            return False

        # Details must be submitted (check for empty dict as well)
        if not self.details_submitted_at or not self.details:
            return False

        # Must have an active payout account
        if not self.account_id or not self.account:
            return False

        # Check if account is ready (details submitted, payments enabled)
        if not self.account.is_account_ready():
            return False

        return True

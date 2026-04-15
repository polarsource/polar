from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, NotRequired, Self, TypedDict
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    CheckConstraint,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    and_,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.enums import (
    InvoiceNumbering,
    PublicSubscriptionProrationBehavior,
    SubscriptionProrationBehavior,
    TaxBehaviorOption,
)
from polar.exceptions import PolarError
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.models import RateLimitGroupMixin, RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

from .account import Account

if TYPE_CHECKING:
    from polar.email.sender import EmailFromReply

    from .organization_agent_review import OrganizationAgentReview
    from .organization_review import OrganizationReview
    from .organization_review_feedback import OrganizationReviewFeedback
    from .payout_account import PayoutAccount
    from .product import Product


class PayoutAccountNotReady(PolarError):
    def __init__(self, organization: "Organization") -> None:
        self.organization = organization
        message = "Your payout account is not ready yet. Complete the setup to receive payouts."
        super().__init__(message, 403)


class OrganizationSocials(TypedDict):
    platform: str
    url: str


class OrganizationDetails(TypedDict, total=False):
    about: str
    product_description: str
    selling_categories: list[str]
    pricing_models: list[str]
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
    proration_behavior: PublicSubscriptionProrationBehavior
    benefit_revocation_grace_period: int
    prevent_trial_abuse: bool
    # Legacy - to be removed separately
    allow_customer_updates: bool


_default_subscription_settings: OrganizationSubscriptionSettings = {
    "allow_multiple_subscriptions": False,
    "allow_customer_updates": True,
    "proration_behavior": SubscriptionProrationBehavior.prorate,
    "benefit_revocation_grace_period": 0,
    "prevent_trial_abuse": False,
}


class OrganizationOrderSettings(TypedDict):
    invoice_numbering: InvoiceNumbering


_default_order_settings: OrganizationOrderSettings = {
    "invoice_numbering": InvoiceNumbering.customer,
}


class OrganizationCustomerEmailSettings(TypedDict):
    order_confirmation: bool
    subscription_cancellation: bool
    subscription_confirmation: bool
    subscription_cycled: bool
    subscription_cycled_after_trial: bool
    subscription_past_due: bool
    subscription_renewal_reminder: bool
    subscription_revoked: bool
    subscription_trial_conversion_reminder: bool
    subscription_uncanceled: bool
    subscription_updated: bool


_default_customer_email_settings: OrganizationCustomerEmailSettings = {
    "order_confirmation": True,
    "subscription_cancellation": True,
    "subscription_confirmation": True,
    "subscription_cycled": True,
    "subscription_cycled_after_trial": True,
    "subscription_past_due": True,
    "subscription_renewal_reminder": True,
    "subscription_revoked": True,
    "subscription_trial_conversion_reminder": True,
    "subscription_uncanceled": True,
    "subscription_updated": True,
}


class CustomerPortalUsageSettings(TypedDict):
    show: bool


class CustomerPortalSubscriptionSettings(TypedDict):
    update_seats: bool
    update_plan: bool


class CustomerPortalCustomerSettings(TypedDict):
    allow_email_change: bool


class OrganizationCustomerPortalSettings(TypedDict):
    usage: CustomerPortalUsageSettings
    subscription: CustomerPortalSubscriptionSettings
    customer: NotRequired[CustomerPortalCustomerSettings]


_default_customer_portal_settings: OrganizationCustomerPortalSettings = {
    "usage": {"show": True},
    "subscription": {
        "update_seats": True,
        "update_plan": True,
    },
    "customer": {
        "allow_email_change": False,
    },
}


class OrganizationCheckoutSettings(TypedDict):
    require_3ds: bool


_default_checkout_settings: OrganizationCheckoutSettings = {
    "require_3ds": True,
}


class OrganizationIndividualLegalEntity(TypedDict):
    type: Literal["individual"]


class OrganizationCompanyLegalEntity(TypedDict):
    type: Literal["company"]
    registered_name: str


OrganizationLegalEntity = (
    OrganizationIndividualLegalEntity | OrganizationCompanyLegalEntity
)


class OrganizationStatus(StrEnum):
    CREATED = "created"
    REVIEW = "review"
    SNOOZED = "snoozed"
    DENIED = "denied"
    ACTIVE = "active"
    BLOCKED = "blocked"
    OFFBOARDING = "offboarding"

    def get_display_name(self) -> str:
        return {
            OrganizationStatus.CREATED: "Created",
            OrganizationStatus.REVIEW: "Review",
            OrganizationStatus.SNOOZED: "Snoozed",
            OrganizationStatus.DENIED: "Denied",
            OrganizationStatus.ACTIVE: "Active",
            OrganizationStatus.BLOCKED: "Blocked",
            OrganizationStatus.OFFBOARDING: "Offboarding",
        }[self]

    @classmethod
    def review_statuses(cls) -> set[Self]:
        return {cls.REVIEW, cls.SNOOZED}  # pyright: ignore

    @classmethod
    def payment_ready_statuses(cls) -> set[Self]:
        return {cls.ACTIVE, cls.OFFBOARDING, *cls.review_statuses()}  # pyright: ignore

    @classmethod
    def payout_ready_statuses(cls) -> set[Self]:
        return {cls.ACTIVE}  # pyright: ignore


class Organization(RateLimitGroupMixin, RecordModel):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("slug"),
        CheckConstraint(
            "next_review_threshold >= 0", name="next_review_threshold_positive"
        ),
    )

    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    _avatar_url: Mapped[str | None] = mapped_column(
        String, name="avatar_url", nullable=True
    )

    email: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    website: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    @property
    def avatar_url(self) -> str | None:
        if self._avatar_url:
            return self._avatar_url

        if not self.website or not settings.LOGO_DEV_PUBLISHABLE_KEY:
            return None

        parsed = urlparse(self.website)
        domain = parsed.netloc or parsed.path
        domain = domain.lower().removeprefix("www.")

        return f"https://img.logo.dev/{domain}?size=64&retina=true&token={settings.LOGO_DEV_PUBLISHABLE_KEY}&fallback=404"

    @avatar_url.setter
    def avatar_url(self, value: str | None) -> None:
        self._avatar_url = value

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

    status: Mapped[OrganizationStatus] = mapped_column(
        StringEnum(OrganizationStatus),
        nullable=False,
        default=OrganizationStatus.CREATED,
    )
    next_review_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1000
    )
    status_updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    initially_reviewed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    snooze_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    total_balance: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, server_default="0"
    )

    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="restrict"),
        nullable=False,
        unique=True,
    )

    @declared_attr
    def account(cls) -> Mapped[Account]:
        return relationship(Account, lazy="raise", back_populates="organizations")

    payout_account_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("payout_accounts.id", ondelete="set null"),
        default=None,
        nullable=True,
        index=True,
    )

    @declared_attr
    def payout_account(cls) -> Mapped["PayoutAccount | None"]:
        return relationship("PayoutAccount", lazy="raise")

    onboarded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    ai_onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # Time of blocking traffic/activity to given organization
    blocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )

    # Flag to block refunds for all orders in this organization
    refunds_blocked: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    country: Mapped[str | None] = mapped_column(String(2), nullable=True, default=None)

    profile_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    subscription_settings: Mapped[OrganizationSubscriptionSettings] = mapped_column(
        JSONB, nullable=False, default=_default_subscription_settings
    )

    order_settings: Mapped[OrganizationOrderSettings] = mapped_column(
        JSONB, nullable=False, default=_default_order_settings
    )

    notification_settings: Mapped[OrganizationNotificationSettings] = mapped_column(
        JSONB, nullable=False, default=_default_notification_settings
    )

    customer_email_settings: Mapped[OrganizationCustomerEmailSettings] = mapped_column(
        JSONB, nullable=False, default=_default_customer_email_settings
    )

    customer_portal_settings: Mapped[OrganizationCustomerPortalSettings] = (
        mapped_column(JSONB, nullable=False, default=_default_customer_portal_settings)
    )

    checkout_settings: Mapped[OrganizationCheckoutSettings] = mapped_column(
        JSONB, nullable=False, default=_default_checkout_settings
    )

    legal_entity: Mapped[OrganizationLegalEntity | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    @property
    def allow_customer_updates(self) -> bool:
        return self.customer_portal_settings["subscription"]["update_plan"]

    #
    # Feature Flags
    #

    feature_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    #
    # Currency and tax settings
    #
    default_presentment_currency: Mapped[PresentmentCurrency] = mapped_column(
        String(3), nullable=False, default="usd"
    )
    default_tax_behavior: Mapped[TaxBehaviorOption] = mapped_column(
        StringEnum(TaxBehaviorOption),
        nullable=False,
        default=TaxBehaviorOption.location,
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
    def can_authenticate(self) -> bool:
        return not self.is_deleted and self.status != OrganizationStatus.BLOCKED

    @can_authenticate.inplace.expression
    @classmethod
    def _can_authenticate_expression(cls) -> ColumnElement[bool]:
        return and_(cls.is_deleted.is_(False), cls.status != OrganizationStatus.BLOCKED)

    def set_status(self, status: OrganizationStatus) -> None:
        self.status = status
        self.status_updated_at = datetime.now(UTC)

    @hybrid_property
    def is_under_review(self) -> bool:
        return self.status in OrganizationStatus.review_statuses()

    @is_under_review.inplace.expression
    @classmethod
    def _is_under_review_expression(cls) -> ColumnElement[bool]:
        return cls.status.in_(OrganizationStatus.review_statuses())

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
    def proration_behavior(self) -> SubscriptionProrationBehavior:
        return SubscriptionProrationBehavior(
            self.subscription_settings["proration_behavior"]
        )

    @property
    def benefit_revocation_grace_period(self) -> int:
        return self.subscription_settings["benefit_revocation_grace_period"]

    @property
    def prevent_trial_abuse(self) -> bool:
        return self.subscription_settings.get("prevent_trial_abuse", False)

    @property
    def invoice_numbering(self) -> InvoiceNumbering:
        return InvoiceNumbering(self.order_settings["invoice_numbering"])

    @property
    def customer_portal_subscription_update_seats(self) -> bool:
        return self.customer_portal_settings.get("subscription", {}).get(
            "update_seats", True
        )

    @property
    def customer_portal_subscription_update_plan(self) -> bool:
        return self.customer_portal_settings.get("subscription", {}).get(
            "update_plan", True
        )

    @property
    def checkout_require_3ds(self) -> bool:
        return self.checkout_settings.get("require_3ds", False)

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

    @declared_attr
    def review(cls) -> Mapped["OrganizationReview | None"]:
        return relationship(
            "OrganizationReview",
            lazy="raise",
            back_populates="organization",
            cascade="delete, delete-orphan",
            uselist=False,  # This makes it a one-to-one relationship
        )

    @declared_attr
    def agent_reviews(cls) -> Mapped[list["OrganizationAgentReview"]]:
        return relationship(
            "OrganizationAgentReview",
            lazy="raise",
            back_populates="organization",
        )

    @declared_attr
    def review_feedbacks(
        cls,
    ) -> Mapped[list["OrganizationReviewFeedback"]]:
        return relationship(
            "OrganizationReviewFeedback",
            lazy="raise",
            back_populates="organization",
        )

    def is_blocked(self) -> bool:
        return self.status == OrganizationStatus.BLOCKED

    def is_active(self) -> bool:
        return self.status == OrganizationStatus.ACTIVE

    def statement_descriptor(self, suffix: str = "") -> str:
        max_length = settings.stripe_descriptor_suffix_max_length
        if suffix:
            space_for_slug = max_length - len(suffix)
            return self.slug[:space_for_slug] + suffix
        return self.slug[:max_length]

    @property
    def statement_descriptor_prefixed(self) -> str:
        # Cannot use *. Setting separator to # instead.
        return f"{settings.STRIPE_STATEMENT_DESCRIPTOR}# {self.statement_descriptor()}"

    @property
    def email_from_reply(self) -> "EmailFromReply":
        return {
            "from_name": f"{self.name} (via {settings.EMAIL_FROM_NAME})",
            "from_email_addr": f"{self.slug}@{settings.EMAIL_FROM_DOMAIN}",
            "reply_to_name": self.name,
            "reply_to_email_addr": self.email
            or settings.EMAIL_DEFAULT_REPLY_TO_EMAIL_ADDRESS,
        }

    def get_ready_payout_account(self) -> "PayoutAccount":
        """
        Return the payout account if it's ready to receive payouts.

        Returns:
            The payout account if it exists and is ready to receive payouts.

        Raises:
            PayoutAccountNotReady: If the payout account does not exist or is not ready to receive payouts.
        """

        if self.payout_account is not None and self.payout_account.is_payout_ready:
            return self.payout_account
        raise PayoutAccountNotReady(self)

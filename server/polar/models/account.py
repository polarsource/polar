from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.enums import AccountType
from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum
from polar.kit.math import polar_round

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


type FeeBasisPoints = int
type FeeFixedCents = int
type Fees = tuple[FeeBasisPoints, FeeFixedCents]


class Account(RecordModel):
    class Status(StrEnum):
        CREATED = "created"
        ONBOARDING_STARTED = "onboarding_started"
        UNDER_REVIEW = "under_review"
        DENIED = "denied"
        ACTIVE = "active"

        def get_display_name(self) -> str:
            return {
                Account.Status.CREATED: "Created",
                Account.Status.ONBOARDING_STARTED: "Onboarding Started",
                Account.Status.UNDER_REVIEW: "Under Review",
                Account.Status.DENIED: "Denied",
                Account.Status.ACTIVE: "Active",
            }[self]

    __tablename__ = "accounts"

    account_type: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )

    admin_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id", use_alter=True))

    stripe_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None
    )
    open_collective_slug: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    email: Mapped[str | None] = mapped_column(String(254), nullable=True, default=None)

    country: Mapped[str] = mapped_column(String(2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3))

    is_details_submitted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_charges_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)

    processor_fees_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    _platform_fee_percent: Mapped[int | None] = mapped_column(
        Integer, name="platform_fee_percent", nullable=True, default=None
    )
    _platform_fee_fixed: Mapped[int | None] = mapped_column(
        Integer, name="platform_fee_fixed", nullable=True, default=None
    )

    business_type: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    status: Mapped[Status] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.CREATED
    )
    next_review_threshold: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=0
    )
    campaign_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("campaigns.id", ondelete="set null"),
        default=None,
        index=True,
    )

    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(AddressType, nullable=True)
    billing_additional_info: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    billing_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def admin(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise", foreign_keys="[Account.admin_id]")

    @declared_attr
    def users(cls) -> Mapped[list["User"]]:
        return relationship(
            "User",
            lazy="raise",
            back_populates="account",
            foreign_keys="[User.account_id]",
        )

    @declared_attr
    def all_organizations(cls) -> Mapped[list["Organization"]]:
        return relationship("Organization", lazy="raise", back_populates="account")

    @declared_attr
    def organizations(cls) -> Mapped[list["Organization"]]:
        return relationship(
            "Organization",
            lazy="raise",
            primaryjoin=(
                "and_("
                "Organization.account_id == Account.id,"
                "Organization.deleted_at.is_(None)"
                ")"
            ),
            viewonly=True,
        )

    def is_active(self) -> bool:
        return self.status == Account.Status.ACTIVE

    def is_under_review(self) -> bool:
        return self.status == Account.Status.UNDER_REVIEW

    def is_payout_ready(self) -> bool:
        return self.is_active() and (
            # For Stripe accounts, check if payouts are enabled.
            # Normally, the account shouldn't be active if payouts are not enabled
            # but let's be extra cautious
            self.account_type != AccountType.stripe or self.is_payouts_enabled
        )

    def get_associations_names(self) -> list[str]:
        associations_names: list[str] = []
        for user in self.users:
            associations_names.append(user.email)
        for organization in self.organizations:
            associations_names.append(organization.slug)
        return associations_names

    @property
    def platform_fee(self) -> Fees:
        basis_points = self._platform_fee_percent
        if basis_points is None:
            basis_points = settings.PLATFORM_FEE_BASIS_POINTS

        fixed = self._platform_fee_fixed
        if fixed is None:
            fixed = settings.PLATFORM_FEE_FIXED

        return (basis_points, fixed)

    def calculate_fee_in_cents(self, amount_in_cents: int) -> int:
        basis_points, fixed = self.platform_fee
        fee_in_cents = (amount_in_cents * (basis_points / 10_000)) + fixed
        # Apply same logic as Stripe fee rounding
        return polar_round(fee_in_cents)

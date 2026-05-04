from datetime import timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.math import polar_round

if TYPE_CHECKING:
    from .account_credit import AccountCredit
    from .organization import Organization
    from .user import User


type FeeBasisPoints = int
type FeeFixedCents = int
type Fees = tuple[FeeBasisPoints, FeeFixedCents]


class Account(RecordModel):
    __tablename__ = "accounts"

    currency: Mapped[str] = mapped_column(String(3))

    processor_fees_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    _platform_fee_percent: Mapped[int | None] = mapped_column(
        Integer, name="platform_fee_percent", nullable=True, default=None
    )
    _platform_fee_fixed: Mapped[int | None] = mapped_column(
        Integer, name="platform_fee_fixed", nullable=True, default=None
    )

    campaign_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("campaigns.id", ondelete="set null"),
        default=None,
        index=True,
    )

    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(AddressType, nullable=True)
    billing_additional_info: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    billing_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    credit_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    admin_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id", use_alter=True))

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
                "Organization.is_deleted.is_(False)"
                ")"
            ),
            viewonly=True,
        )

    @declared_attr
    def credits(cls) -> Mapped[list["AccountCredit"]]:
        return relationship("AccountCredit", lazy="raise", back_populates="account")

    @property
    def payout_interval(self) -> timedelta:
        return settings.ACCOUNT_DEFAULT_PAYOUT_INTERVAL

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

    def reduce_credit_balance(self, amount: int) -> None:
        self.credit_balance -= min(amount, self.credit_balance)

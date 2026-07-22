from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PayoutAccountStatus, PayoutAccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .user import User

# Stripe `requirements.disabled_reason` values the merchant can act on themselves.
ACTION_REQUIRED_DISABLED_REASONS = frozenset(
    {"requirements.past_due", "action_required.requested_capabilities"}
)
# Values meaning Stripe is still deciding. Anything else — `listed`, `rejected.*`,
# `platform_paused`, `other` — is a compliance outcome we don't disclose to the merchant.
AWAITING_STRIPE_DISABLED_REASONS = frozenset(
    {"requirements.pending_verification", "under_review"}
)


class PayoutAccount(RecordModel):
    __tablename__ = "payout_accounts"

    type: Mapped[PayoutAccountType] = mapped_column(
        StringEnum(PayoutAccountType), nullable=False
    )

    admin_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))

    stripe_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None
    )
    open_collective_slug: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None, deferred=True
    )

    email: Mapped[str | None] = mapped_column(String(254), nullable=True, default=None)

    country: Mapped[str] = mapped_column(String(2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3))

    is_details_submitted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_charges_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    business_type: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    @declared_attr
    def admin(cls) -> Mapped["User"]:
        return relationship(
            "User", lazy="raise", foreign_keys="[PayoutAccount.admin_id]"
        )

    @property
    def is_payout_ready(self) -> bool:
        # For Stripe accounts, check if payouts are enabled
        # and that a Stripe account is actually connected.
        # After a disconnect, stripe_id is cleared but the account
        # may still be active with is_payouts_enabled=True.
        return self.type != PayoutAccountType.stripe or (
            self.is_payouts_enabled and self.stripe_id is not None
        )

    @property
    def status(self) -> PayoutAccountStatus:
        if self.is_payout_ready:
            return PayoutAccountStatus.ready

        requirements = self.data.get("requirements") or {}
        disabled_reason = requirements.get("disabled_reason")

        if (
            self.stripe_id is None
            or not self.is_details_submitted
            or disabled_reason in ACTION_REQUIRED_DISABLED_REASONS
        ):
            return PayoutAccountStatus.incomplete

        if (
            disabled_reason is None
            or disabled_reason in AWAITING_STRIPE_DISABLED_REASONS
        ):
            return PayoutAccountStatus.under_review

        return PayoutAccountStatus.paused

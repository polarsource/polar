from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .payout import Payout


class PayoutAttemptStatus(StrEnum):
    pending = "pending"
    in_transit = "in_transit"
    succeeded = "succeeded"
    failed = "failed"

    @classmethod
    def from_stripe(cls, stripe_status: str) -> "PayoutAttemptStatus":
        if stripe_status == "in_transit":
            return cls.in_transit
        if stripe_status == "paid":
            return cls.succeeded
        if stripe_status == "failed":
            return cls.failed
        return cls.pending


class PayoutAttempt(RecordModel):
    __tablename__ = "payout_attempts"

    payout_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("payouts.id", ondelete="cascade"), nullable=False
    )
    """ID of the associated Payout."""
    payout: Mapped["Payout"] = relationship("Payout", back_populates="attempts")

    processor: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )
    """Payment processor used for this payout attempt."""
    processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=False
    )
    """ID of the payout in the payment processor (Stripe payout ID)."""
    status: Mapped[PayoutAttemptStatus] = mapped_column(
        StringEnum(PayoutAttemptStatus),
        nullable=False,
        index=True,
        default=PayoutAttemptStatus.pending,
    )
    """Status of this payout attempt."""
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Amount in smallest currency units for this payout attempt."""
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this payout attempt."""
    failed_reason: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    """Reason for failure, if applicable."""
    paid_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    """Date and time when this payout attempt was paid."""

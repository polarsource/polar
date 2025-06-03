from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .account import Account
    from .transaction import Transaction


class PayoutStatus(StrEnum):
    pending = "pending"
    in_transit = "in_transit"
    succeeded = "succeeded"

    @classmethod
    def from_stripe(cls, stripe_status: str) -> "PayoutStatus":
        if stripe_status == "in_transit":
            return cls.in_transit
        if stripe_status == "paid":
            return cls.succeeded
        return cls.pending


class Payout(RecordModel):
    __tablename__ = "payouts"

    processor: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )
    """Payment processor used for this payout."""
    processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=True
    )
    """ID of the payout in the payment processor. Might be `None` if not yet created."""
    status: Mapped[PayoutStatus] = mapped_column(
        StringEnum(PayoutStatus),
        nullable=False,
        index=True,
        default=PayoutStatus.pending,
    )
    """Status of this payout."""
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this transaction from Polar's perspective. Should be `usd`."""
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Amount in cents of this transaction from Polar's perspective."""
    fees_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Fees amount in cents of this transaction from Polar's perspective."""
    account_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this transaction from user's account perspective. Might not be `usd`."""
    account_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Amount in cents of this transaction from user's account perspective."""

    account_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="restrict"), nullable=False, index=True
    )
    """ID of the `Account` concerned by this payout."""
    account: Mapped["Account"] = relationship("Account", lazy="raise")

    invoice_number: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    """Reverse invoice number for this payout. Might be `None` if not yet created."""
    invoice_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    """Optional notes to be added at the bottom of the invoice for this payout."""
    invoice_path: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    """
    Path to the invoice for this payout on the storage bucket.

    Might be `None` if not yet created.
    """

    transaction: Mapped["Transaction"] = relationship(
        "Transaction",
        back_populates="payout",
        lazy="raise",
        uselist=False,
        foreign_keys="Transaction.payout_id",
    )
    """Transaction associated with this payout."""

    @property
    def gross_amount(self) -> int:
        """Gross amount of this payout in cents."""
        return self.amount + self.fees_amount

    @property
    def fees_transactions(self) -> list["Transaction"]:
        """List of transactions that are fees for this payout."""
        return [
            transaction
            for transaction in self.transaction.incurred_transactions
            if transaction.account_id is not None
        ]

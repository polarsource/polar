from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.models.transaction import TransactionType

from .payout_attempt import PayoutAttempt, PayoutAttemptStatus

if TYPE_CHECKING:
    from .account import Account
    from .transaction import Transaction


class PayoutStatus(StrEnum):
    pending = "pending"
    in_transit = "in_transit"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"

    def is_cancelable(self) -> bool:
        """Whether a payout with this status can be canceled."""
        return self in {PayoutStatus.pending, PayoutStatus.failed}


class Payout(RecordModel):
    __tablename__ = "payouts"
    __table_args__ = (UniqueConstraint("account_id", "invoice_number"),)

    processor: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )
    """Payment processor used for this payout."""
    status: Mapped[PayoutStatus] = mapped_column(
        StringEnum(PayoutStatus),
        nullable=False,
        index=True,
        default=PayoutAttemptStatus.pending,
    )
    """
    Status of this payout attempt.

    Automatically kept in sync by a trigger defined in server/polar/models/payout_attempt.py
    """
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
        Uuid, ForeignKey("accounts.id", ondelete="restrict"), nullable=False
    )
    """ID of the `Account` concerned by this payout."""
    account: Mapped["Account"] = relationship("Account", lazy="raise")

    invoice_number: Mapped[str] = mapped_column(String, nullable=False)
    """Reverse invoice number for this payout."""
    invoice_path: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    """
    Path to the invoice for this payout on the storage bucket.

    Might be `None` if not yet created.
    """

    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        back_populates="payout",
        lazy="raise",
        foreign_keys="Transaction.payout_id",
    )
    """Transactions associated with this payout."""

    attempts: Mapped[list["PayoutAttempt"]] = relationship(
        "PayoutAttempt",
        back_populates="payout",
        lazy="joined",
        order_by="PayoutAttempt.created_at.asc()",
    )
    """Payout attempts associated with this payout."""

    @property
    def transaction(self) -> "Transaction":
        return next(
            transaction
            for transaction in self.transactions
            if transaction.type == TransactionType.payout
        )

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

    @property
    def is_invoice_generated(self) -> bool:
        """Whether the invoice for this payout has been generated."""
        return self.invoice_path is not None

    @property
    def latest_attempt(self) -> "PayoutAttempt | None":
        """The latest payout attempt for this payout, or `None` if there are no attempts."""
        if not self.attempts:
            return None
        return self.attempts[-1]

    @property
    def paid_at(self) -> datetime | None:
        """Date when this payout was paid (from first successful attempt)."""
        for attempt in self.attempts:
            if (
                attempt.status == PayoutAttemptStatus.succeeded
                and attempt.paid_at is not None
            ):
                return attempt.paid_at
        return None

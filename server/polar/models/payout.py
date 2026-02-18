from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    and_,
    case,
    exists,
    select,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

from .payout_attempt import PayoutAttempt, PayoutAttemptStatus

if TYPE_CHECKING:
    from .account import Account
    from .transaction import Transaction


class PayoutStatus(StrEnum):
    pending = "pending"
    in_transit = "in_transit"
    succeeded = "succeeded"
    failed = "failed"


class Payout(RecordModel):
    __tablename__ = "payouts"
    __table_args__ = (UniqueConstraint("account_id", "invoice_number"),)

    processor: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )
    """Payment processor used for this payout."""
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

    transaction: Mapped["Transaction"] = relationship(
        "Transaction",
        back_populates="payout",
        lazy="raise",
        uselist=False,
        foreign_keys="Transaction.payout_id",
    )
    """Transaction associated with this payout."""

    attempts: Mapped[list["PayoutAttempt"]] = relationship(
        "PayoutAttempt",
        back_populates="payout",
        lazy="joined",
        order_by="PayoutAttempt.created_at.asc()",
    )
    """Payout attempts associated with this payout."""

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

    @hybrid_property
    def status(self) -> PayoutStatus:
        """Status of this payout, derived from the status of its attempts."""
        latest_attempt = self.latest_attempt

        if latest_attempt is None:
            return PayoutStatus.pending

        # If any attempt succeeded, the payout is succeeded
        if any(
            attempt.status == PayoutAttemptStatus.succeeded for attempt in self.attempts
        ):
            return PayoutStatus.succeeded

        if latest_attempt.status == PayoutAttemptStatus.in_transit:
            return PayoutStatus.in_transit

        # If all attempts failed, payout is failed
        if all(
            attempt.status == PayoutAttemptStatus.failed for attempt in self.attempts
        ):
            return PayoutStatus.failed

        # Otherwise, pending
        return PayoutStatus.pending

    @status.inplace.expression
    @classmethod
    def _status_expression(cls) -> ColumnElement[PayoutStatus]:
        # Subquery to check if any attempt succeeded
        has_succeeded = exists(
            select(PayoutAttempt.id).where(
                PayoutAttempt.payout_id == cls.id,
                PayoutAttempt.status == PayoutAttemptStatus.succeeded,
            )
        )

        # Subquery to get the latest attempt's status
        latest_attempt_status = (
            select(PayoutAttempt.status)
            .where(PayoutAttempt.payout_id == cls.id)
            .order_by(PayoutAttempt.created_at.desc())
            .limit(1)
            .correlate(cls)
            .scalar_subquery()
        )

        # Subquery to check if there are any attempts
        has_attempts = exists(
            select(PayoutAttempt.id).where(PayoutAttempt.payout_id == cls.id)
        )

        # Subquery to check if all attempts failed
        # (no attempts that are not failed)
        all_failed = and_(
            has_attempts,
            ~exists(
                select(PayoutAttempt.id).where(
                    PayoutAttempt.payout_id == cls.id,
                    PayoutAttempt.status != PayoutAttemptStatus.failed,
                )
            ),
        )

        return case(
            # If any attempt succeeded, the payout is succeeded
            (has_succeeded, PayoutStatus.succeeded),
            # If no attempts, pending
            (~has_attempts, PayoutStatus.pending),
            # If latest attempt is in_transit
            (
                latest_attempt_status == PayoutAttemptStatus.in_transit,
                PayoutStatus.in_transit,
            ),
            # If all attempts failed, payout is failed
            (all_failed, PayoutStatus.failed),
            # Otherwise, pending
            else_=PayoutStatus.pending,
        )

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

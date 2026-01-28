"""
Bank details storage for Mercury payouts.

Security: Bank account numbers are encrypted at rest using Fernet (AES-128-CBC).
The encryption key should be stored in environment variables, never in code.
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, LargeBinary, String, Uuid
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .account import Account


class VerificationMethod(StrEnum):
    """How the bank account was verified."""

    stripe_financial_connections = "stripe_financial_connections"
    plaid = "plaid"
    manual = "manual"  # For backwards compatibility or special cases


class BankAccountType(StrEnum):
    """Type of bank account."""

    checking = "checking"
    savings = "savings"


class AccountBankDetails(RecordModel):
    """
    Stores verified bank account details for Mercury payouts.

    Bank details are collected via Stripe Financial Connections during onboarding,
    then used to create Mercury recipients for instant payouts.
    """

    __tablename__ = "account_bank_details"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Encrypted bank details - use AccountBankDetailsService for access
    routing_number_encrypted: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False
    )
    account_number_encrypted: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False
    )

    # Visible portion for UI display
    account_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)

    account_type: Mapped[BankAccountType] = mapped_column(
        StringEnum(BankAccountType), nullable=False
    )

    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Verification metadata
    verification_method: Mapped[VerificationMethod] = mapped_column(
        StringEnum(VerificationMethod), nullable=False
    )
    verified_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

    # Stripe Financial Connections reference
    stripe_financial_connection_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    # Mercury recipient tracking
    mercury_recipient_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    mercury_recipient_created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    @declared_attr
    def account(cls) -> Mapped["Account"]:
        return relationship("Account", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"AccountBankDetails("
            f"id={self.id!r}, "
            f"account_id={self.account_id!r}, "
            f"last4=****{self.account_number_last4}, "
            f"bank={self.bank_name!r}"
            f")"
        )

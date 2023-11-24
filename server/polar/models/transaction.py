from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import (
        Account,
        IssueReward,
        Organization,
        Pledge,
        Subscription,
        User,
    )


class TransactionType(StrEnum):
    """
    Type of transactions.
    """

    payment = "payment"
    """Polar received a payment."""
    refund = "refund"
    """Polar refunded a payment (totally or partially)."""
    dispute = "dispute"
    """A Polar payment is disputed (totally or partially)."""
    transfer = "transfer"
    """Money transfer between Polar and a user's account."""
    payout = "payout"
    """Money paid to the user's bank account."""


class PaymentProcessor(StrEnum):
    """
    Supported payment processors.
    """

    stripe = "stripe"
    open_collective = "open_collective"


class Transaction(RecordModel):
    """
    Represent a money flow in the Polar system.
    """

    __tablename__ = "transactions"

    type: Mapped[TransactionType] = mapped_column(String, nullable=False, index=True)
    """Type of transaction."""
    processor: Mapped[PaymentProcessor] = mapped_column(
        String, nullable=False, index=True
    )
    """Payment processor."""

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this transaction from Polar's perspective. Should be `usd`."""
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Amount in cents of this transaction from Polar's perspective."""
    account_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this transaction from user's account perspective. Might not be `usd`."""
    account_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Amount in cents of this transaction from user's account perspective."""
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Amount of tax collected by Polar for this payment."""
    tax_country: Mapped[str] = mapped_column(String(2), nullable=True, index=True)
    """Country for which Polar collected the tax."""
    tax_state: Mapped[str] = mapped_column(String(2), nullable=True, index=True)
    """State for which Polar collected the tax."""
    processor_fee_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Fee collected by the payment processor for this transaction."""

    transfer_correlation_key: Mapped[str] = mapped_column(
        String, nullable=True, index=True
    )
    """
    Internal key used to correlate a couple of transfer transactions:
    the outgoing side and the incoming side.
    """

    customer_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the customer in the payment processor system."""
    charge_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the charge (payment) in the payment processor system."""
    refund_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the refund in the payment processor system."""
    dispute_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the dispute in the payment processor system."""
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the transfer in the payment processor system."""
    transfer_reversal_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
    """ID of the transfer reversal in the payment processor system."""
    payout_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the payout in the payment processor system."""

    account_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """
    ID of the `Account` concerned by this transaction.

    If `None`, this transaction concerns Polar directly.
    """

    @declared_attr
    def account(cls) -> Mapped["Account | None"]:
        return relationship("Account", lazy="raise")

    payment_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `User` who made the payment."""

    @declared_attr
    def payment_user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

    payment_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Organization` who made the payment."""

    @declared_attr
    def payment_organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    pledge_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("pledges.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Pledge` related to this transaction."""

    @declared_attr
    def pledge(cls) -> Mapped["Pledge | None"]:
        return relationship("Pledge", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Subscription` related to this transaction."""

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    issue_reward_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("issue_rewards.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `IssueReward` related to this transaction."""

    @declared_attr
    def issue_reward(cls) -> Mapped["IssueReward | None"]:
        return relationship("IssueReward", lazy="raise")

    payment_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the transaction that pays for this transaction."""

    @declared_attr
    def payment_transaction(cls) -> Mapped["Transaction | None"]:
        """Transaction that pays for this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            foreign_keys="[Transaction.payment_transaction_id]",
            back_populates="transfer_transactions",
        )

    @declared_attr
    def transfer_transactions(cls) -> Mapped[list["Transaction"]]:
        """Transactions that transferred this payment transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            back_populates="payment_transaction",
            foreign_keys="[Transaction.payment_transaction_id]",
        )

    transfer_reversal_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the transfer transaction that reverses this transaction."""

    @declared_attr
    def transfer_reversal_transaction(cls) -> Mapped["Transaction | None"]:
        """Transfer transaction that reverses this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            foreign_keys="[Transaction.transfer_reversal_transaction_id]",
        )

    payout_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the transaction that paid out this transaction."""

    @declared_attr
    def payout_transaction(cls) -> Mapped["Transaction | None"]:
        """Transaction that paid out this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            foreign_keys="[Transaction.payout_transaction_id]",
        )

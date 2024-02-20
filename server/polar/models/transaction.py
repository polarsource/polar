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
    processor_fee = "processor_fee"
    """A payment processor fee was charged to Polar."""
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


class ProcessorFeeType(StrEnum):
    """
    Type of fees applied by payment processors, and billed to the users.
    """

    payment = "payment"
    """
    Fee applied to a payment, like a credit card fee.
    """

    refund = "refund"
    """
    Fee applied when a refund is issued.
    """

    dispute = "dispute"
    """
    Fee applied when a dispute is opened. Usually crazy high.
    """

    tax = "tax"
    """
    Fee applied for automatic tax calculation and collection.

    For Stripe, it corresponds to **0.5% of the amount**.
    """

    subscription = "subscription"
    """
    Fee applied to a recurring subscription.

    For Stripe, it corresponds to **0.5% of the subscription amount**.
    """

    invoice = "invoice"
    """
    Fee applied to an issued invoice.

    For Stripe, it corresponds to **0.4%%** on Starter, **0.5%** on Plus of the amount.
    """

    cross_border_transfer = "cross_border_transfer"
    """
    Fee applied when money is transferred to a different country than Polar's.

    For Stripe, it varies per country. Usually around **0.25% and 1% of the amount**.
    """

    payout = "payout"
    """
    Fee applied when money is paid out to the user's bank account.

    For Stripe, it's **0.25% of the amount + 0.25$ per payout**.
    """

    account = "account"
    """
    Fee applied recurrently to an active account.

    For Stripe, it's **2$ per month**.
    It considers an account active if a payout has been made in the month.
    """


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

    processor_fee_type: Mapped[ProcessorFeeType | None] = mapped_column(
        String, nullable=True, index=True
    )
    """
    Type of processor fee. Only applies to transactions of type `TransactionType.processor_fee`.
    """

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
    fee_balance_transaction_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
    """ID of the fee's balance transaction in the payment processor system."""

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
            back_populates="paid_transactions",
        )

    @declared_attr
    def paid_transactions(cls) -> Mapped[list["Transaction"]]:
        """Transactions that were paid out by this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            back_populates="payout_transaction",
            foreign_keys="[Transaction.payout_transaction_id]",
        )

    incurred_by_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """
    ID of the transaction that incurred this fee transaction.
    Only applies to transactions of type `TransactionType.processor_fee`.
    """

    @declared_attr
    def incurred_by_transaction(cls) -> Mapped["Transaction | None"]:
        """
        Transaction that incurred this fee transaction.
        Only applies to transactions of type `TransactionType.processor_fee`.
        """
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            back_populates="incurred_transaction_fees",
            foreign_keys="[Transaction.incurred_by_transaction_id]",
        )

    @declared_attr
    def incurred_transaction_fees(cls) -> Mapped[list["Transaction"]]:
        """Transaction fees that were incurred by this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            back_populates="incurred_by_transaction",
            foreign_keys="[Transaction.incurred_by_transaction_id]",
        )

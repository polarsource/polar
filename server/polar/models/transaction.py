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
        Donation,
        IssueReward,
        Organization,
        Pledge,
        Subscription,
        SubscriptionTierPrice,
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
    balance = "balance"
    """Money flow between Polar and a user's account."""
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


class PlatformFeeType(StrEnum):
    """
    Type of fees applied by Polar, and billed to the users.
    """

    platform = "platform"
    """
    Polar platform fee.
    """

    payment = "payment"
    """
    Fee applied by the payment processor to a payment, like a credit card fee.
    """

    subscription = "subscription"
    """
    Fee applied by the payment processor to a recurring subscription.
    """

    invoice = "invoice"
    """
    Fee applied by the payment processor to an issued invoice.
    """

    cross_border_transfer = "cross_border_transfer"
    """
    Fee applied by the payment processor when money is transferred
    to a different country than Polar's.
    """

    payout = "payout"
    """
    Fee applied by the payment processor when money
    is paid out to the user's bank account.
    """

    account = "account"
    """
    Fee applied recurrently by the payment processor to an active account.
    """


class Transaction(RecordModel):
    """
    Represent a money flow in the Polar system.
    """

    __tablename__ = "transactions"

    type: Mapped[TransactionType] = mapped_column(String, nullable=False, index=True)
    """Type of transaction."""
    processor: Mapped[PaymentProcessor | None] = mapped_column(
        String, nullable=True, index=True
    )
    """Payment processor. For TransactionType.balance, it should be `None`."""

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

    balance_correlation_key: Mapped[str] = mapped_column(
        String, nullable=True, index=True
    )
    """
    Internal key used to correlate a couple of balance transactions:
    the outgoing side and the incoming side.
    """

    platform_fee_type: Mapped[PlatformFeeType | None] = mapped_column(
        String, nullable=True, index=True
    )
    """
    Type of platform fee.

    Only applies to transactions of type `TransactionType.balance`
    with a set `account_id`.
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

    donation_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("donations.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Donation` related to this transaction."""

    @declared_attr
    def donation(cls) -> Mapped["Donation | None"]:
        return relationship("Donation", lazy="raise")

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

    subscription_tier_price_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_tier_prices.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """
    ID of the `SubscriptionTierPrice` related to this transaction.

    Useful to keep track of the price at the time of the transaction,
    which might change if the subscription is upgraded or downgraded.
    """

    @declared_attr
    def subscription_tier_price(cls) -> Mapped["SubscriptionTierPrice | None"]:
        return relationship("SubscriptionTierPrice", lazy="raise")

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
            back_populates="balance_transactions",
        )

    @declared_attr
    def balance_transactions(cls) -> Mapped[list["Transaction"]]:
        """Transactions that were balanced by this payment transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            back_populates="payment_transaction",
            foreign_keys="[Transaction.payment_transaction_id]",
        )

    balance_reversal_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the balance transaction which is reversed by this transaction."""

    @declared_attr
    def balance_reversal_transaction(cls) -> Mapped["Transaction | None"]:
        """Balance transaction which is reversed by this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            foreign_keys="[Transaction.balance_reversal_transaction_id]",
            back_populates="balance_reversal_transactions",
        )

    @declared_attr
    def balance_reversal_transactions(cls) -> Mapped[list["Transaction"]]:
        """Balance transactions that reverses this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            foreign_keys="[Transaction.balance_reversal_transaction_id]",
            back_populates="balance_reversal_transaction",
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
    ID of the transaction that incurred this transaction.
    Generally applies to transactions of type `TransactionType.processor_fee`
    or platform fees balances.
    """

    @declared_attr
    def incurred_by_transaction(cls) -> Mapped["Transaction | None"]:
        """
        Transaction that incurred this transaction.
        Generally applies to transactions of type `TransactionType.processor_fee`
        or platform fees balances.
        """
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
            back_populates="incurred_transactions",
            foreign_keys="[Transaction.incurred_by_transaction_id]",
        )

    @declared_attr
    def incurred_transactions(cls) -> Mapped[list["Transaction"]]:
        """Transactions that were incurred by this transaction."""
        return relationship(
            "Transaction",
            lazy="raise",
            back_populates="incurred_by_transaction",
            foreign_keys="[Transaction.incurred_by_transaction_id]",
        )

    @declared_attr
    def account_incurred_transactions(cls) -> Mapped[list["Transaction"]]:
        """
        Transactions that were incurred by this transaction,
        filtered on the current transaction account.
        """
        return relationship(
            "Transaction",
            lazy="raise",
            foreign_keys="[Transaction.incurred_by_transaction_id]",
            primaryjoin=(
                "and_("
                "foreign(Transaction.incurred_by_transaction_id) == Transaction.id, "
                "foreign(Transaction.account_id) == Transaction.account_id,"
                ")"
            ),
            viewonly=True,
        )

    @property
    def incurred_amount(self) -> int:
        return sum(
            transaction.amount for transaction in self.account_incurred_transactions
        )

    @property
    def gross_amount(self) -> int:
        inclusive = 0 if self.type == TransactionType.balance else 1
        return self.amount + inclusive * self.incurred_amount

    @property
    def net_amount(self) -> int:
        inclusive = 1 if self.type == TransactionType.balance else -1
        return self.gross_amount + inclusive * self.incurred_amount

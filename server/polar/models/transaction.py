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
        Pledge,
        Subscription,
    )


class TransactionType(StrEnum):
    payment = "payment"
    refund = "refund"
    transfer = "transfer"
    payout = "payout"


class PaymentProcessor(StrEnum):
    stripe = "stripe"
    open_collective = "open_collective"


class Transaction(RecordModel):
    __tablename__ = "transactions"

    type: Mapped[TransactionType] = mapped_column(String, nullable=False, index=True)
    processor: Mapped[PaymentProcessor] = mapped_column(
        String, nullable=False, index=True
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    processor_fee_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    charge_id: Mapped[str | None] = mapped_column(String, nullable=True)
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payout_id: Mapped[str | None] = mapped_column(String, nullable=True)

    account_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("accounts.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def account(cls) -> Mapped["Account | None"]:
        return relationship("Account", lazy="raise")

    pledge_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("pledges.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def pledge(cls) -> Mapped["Pledge | None"]:
        return relationship("Pledge", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    issue_reward_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("issue_rewards.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def issue_reward(cls) -> Mapped["IssueReward | None"]:
        return relationship("IssueReward", lazy="raise")

    payout_transaction_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def payout_transaction(cls) -> Mapped["Transaction | None"]:
        return relationship(
            "Transaction",
            lazy="raise",
            # Ref: https://docs.sqlalchemy.org/en/20/orm/self_referential.html
            remote_side=[
                cls.id,  # type: ignore
            ],
        )

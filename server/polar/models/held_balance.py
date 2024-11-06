from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import (
        Account,
        IssueReward,
        Order,
        Organization,
        Pledge,
        Transaction,
    )


class HeldBalance(RecordModel):
    """
    Represent an on hold balance.

    It may happen because the destination account is not yet created.

    When the account is successfully created, those balances should be executed.
    """

    __tablename__ = "held_balances"

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    """
    ID of the `Organization` concerned by this balance.
    Set only if the account is not yet created.
    """

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    """
    ID of the `Account` concerned by this balance.
    Will be `None` if the account is not yet created.
    """

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def account(cls) -> Mapped["Account | None"]:
        return relationship("Account", lazy="raise")

    payment_transaction_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("transactions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """ID of the transaction that pays for this balance."""

    @declared_attr
    def payment_transaction(cls) -> Mapped["Transaction"]:
        """Transaction that pays for this balance."""
        return relationship("Transaction", lazy="raise")

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Amount in cents to balance."""

    pledge_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("pledges.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Pledge` related to this balance."""

    @declared_attr
    def pledge(cls) -> Mapped["Pledge | None"]:
        return relationship("Pledge", lazy="raise")

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Order` related to this balance."""

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    issue_reward_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("issue_rewards.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `IssueReward` related to this balance."""

    @declared_attr
    def issue_reward(cls) -> Mapped["IssueReward | None"]:
        return relationship("IssueReward", lazy="raise")

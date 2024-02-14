from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
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
        Transaction,
    )


class HeldTransfer(RecordModel):
    """
    Represent an on hold transfer. It may happen because

    * The destination account is not yet created
    * The destination account is under review

    When the account is successfully created or reviewed,
    those transfers should be actually executed.
    """

    __tablename__ = "held_transfers"

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    """
    ID of the `Organization` concerned by this transfer.
    Set only if the account is not yet created.
    """

    account_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("accounts.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    """
    ID of the `Account` concerned by this transfer.
    Will be `None` if the account is not yet created.
    """

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def account(cls) -> Mapped["Account | None"]:
        return relationship("Account", lazy="raise")

    payment_transaction_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("transactions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """ID of the transaction that pays for this transfer."""

    @declared_attr
    def payment_transaction(cls) -> Mapped["Transaction"]:
        """Transaction that pays for this transfer."""
        return relationship("Transaction", lazy="raise")

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    """Amount in cents to transfer."""

    pledge_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("pledges.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Pledge` related to this transfer."""

    @declared_attr
    def pledge(cls) -> Mapped["Pledge | None"]:
        return relationship("Pledge", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `Subscription` related to this transfer."""

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    issue_reward_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("issue_rewards.id", ondelete="set null"),
        nullable=True,
        index=True,
    )
    """ID of the `IssueReward` related to this transfer."""

    @declared_attr
    def issue_reward(cls) -> Mapped["IssueReward | None"]:
        return relationship("IssueReward", lazy="raise")

    transfer_metadata: Mapped[dict[str, str] | None] = mapped_column(
        "properties", JSONB, nullable=True
    )
    """Additional metadata to join with the transfer."""

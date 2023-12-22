from enum import StrEnum
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue_reward import IssueReward
from polar.models.pledge import Pledge


class PledgeTransactionType(StrEnum):
    pledge = "pledge"
    transfer = "transfer"
    refund = "refund"
    disputed = "disputed"


class PledgeTransaction(RecordModel):
    __tablename__ = "pledge_transactions"

    pledge_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pledges.id"), nullable=False
    )
    type: Mapped[PledgeTransactionType] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    transaction_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    issue_reward_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("issue_rewards.id"), nullable=True, default=None
    )

    @declared_attr
    def pledge(cls) -> Mapped[Pledge]:
        return relationship(
            Pledge,
            lazy="raise",
        )

    @declared_attr
    def issue_reward(cls) -> Mapped[IssueReward]:
        return relationship(
            IssueReward,
            lazy="raise",
        )

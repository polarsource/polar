from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue_reward import IssueReward
from polar.models.pledge import Pledge


class PledgeTransaction(RecordModel):
    __tablename__ = "pledge_transactions"

    pledge_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pledges.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    transaction_id: Mapped[str] = mapped_column(String, nullable=True)
    issue_reward_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("issue_rewards.id"), nullable=True
    )

    pledge: Mapped[Pledge] = relationship(
        "Pledge", foreign_keys=[pledge_id], lazy="raise"
    )

    issue_reward: Mapped[IssueReward] = relationship(
        "IssueReward", foreign_keys=[issue_reward_id], lazy="raise"
    )

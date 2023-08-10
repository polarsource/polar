from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.pledge import Pledge
from polar.models.pledge_split import PledgeSplit


class PledgeTransaction(RecordModel):
    __tablename__ = "pledge_transactions"

    pledge_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pledges.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    transaction_id: Mapped[str] = mapped_column(String, nullable=True)
    pledge_split_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pledge_splits.id"), nullable=True
    )

    pledge: Mapped[Pledge] = relationship(
        "Pledge", foreign_keys=[pledge_id], lazy="raise"
    )

    pledge_split: Mapped[PledgeSplit] = relationship(
        "PledgeSplit", foreign_keys=[pledge_split_id], lazy="raise"
    )

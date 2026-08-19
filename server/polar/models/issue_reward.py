from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .pledge import Pledge


class IssueReward(RecordModel):
    __tablename__ = "issue_rewards"

    issue_reference: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # 10% == 100
    share_thousands: Mapped[int] = mapped_column(BigInteger, nullable=False)

    @property
    def pct(self) -> Decimal:
        # Use decimal to avoid binary floating point issues
        return Decimal(self.share_thousands) / 1000

    def get_share_amount(self, pledge: "Pledge") -> int:
        return round(pledge.amount * self.pct)

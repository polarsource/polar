from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.organization import Organization
from polar.models.user import User

if TYPE_CHECKING:
    from .account import Account
    from .pledge import Pledge


class IssueReward(RecordModel):
    __tablename__ = "issue_rewards"

    __table_args__ = (
        UniqueConstraint("issue_id", "github_username"),
        UniqueConstraint("issue_id", "organization_id"),
        UniqueConstraint("issue_id", "user_id"),
    )

    issue_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("issues.id"), nullable=False
    )

    # 10% == 100
    share_thousands: Mapped[int] = mapped_column(BigInteger, nullable=False)

    github_username: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=True, default=None
    )

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped[Organization]:
        return relationship(
            Organization,
            lazy="raise",
        )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User, lazy="raise")

    @property
    def pct(self) -> Decimal:
        # Use decimal to avoid binary floating point issues
        return Decimal(self.share_thousands) / 1000

    def get_share_amount(self, pledge: "Pledge") -> int:
        return round(pledge.amount * self.pct)

    def get_rewarded(self) -> "Organization | User | None":
        if self.organization is not None:
            return self.organization
        elif self.user is not None:
            return self.user
        return None

    def get_rewarded_account(self) -> "Account | None":
        rewarded = self.get_rewarded()
        if rewarded is not None:
            return rewarded.account
        return None

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.organization import Organization
from polar.models.user import User


class IssueReward(RecordModel):
    __tablename__ = "issue_rewards"

    __table_args__ = (
        UniqueConstraint("issue_id", "github_username"),
        UniqueConstraint("issue_id", "organization_id"),
        UniqueConstraint("issue_id", "user_id"),
    )

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("issues.id"), nullable=False
    )

    # 10% == 100
    share_thousands: Mapped[int] = mapped_column(BigInteger, nullable=False)

    github_username: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=True, default=None
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True, default=None
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

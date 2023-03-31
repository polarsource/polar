from uuid import UUID

from sqlalchemy import String, BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.organization import Organization
from polar.models.user import User


class Pledge(RecordModel):
    __tablename__ = "pledges"

    issue_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    repository_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    organization_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    payment_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    transfer_id: Mapped[str] = mapped_column(String, nullable=True)

    email: Mapped[str] = mapped_column(String, nullable=True, index=True, default=None)

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)

    state: Mapped[str] = mapped_column(String, nullable=False, default="initiated")

    by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        default=None,
    )

    by_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        default=None,
    )

    user: Mapped[User] = relationship("User", foreign_keys=[by_user_id], lazy="joined")

    organization: Mapped[Organization] = relationship(
        "Organization", foreign_keys=[by_organization_id], lazy="joined"
    )

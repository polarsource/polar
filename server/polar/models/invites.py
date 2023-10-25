from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class Invite(RecordModel):
    __tablename__ = "invites"

    created_by: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    claimed_by: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True
    )

    code: Mapped[str] = mapped_column(String, nullable=False, index=True, unique=True)

    claimed_by_user: Mapped[User] = relationship(
        "User", lazy="raise", foreign_keys=[claimed_by]
    )

    created_by_user: Mapped[User] = relationship(
        "User", lazy="raise", foreign_keys=[created_by]
    )

    note: Mapped[str | None] = mapped_column(String, nullable=True)

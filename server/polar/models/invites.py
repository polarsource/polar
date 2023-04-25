from uuid import UUID
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class Invite(RecordModel):
    __tablename__ = "invites"

    created_by: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    sent_to_email: Mapped[str | None] = mapped_column(String, nullable=True)

    claimed_by: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True
    )

    code: Mapped[str] = mapped_column(String, nullable=False, index=True, unique=True)

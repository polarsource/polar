from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue
from polar.models.pledge import Pledge


class Notification(RecordModel):
    __tablename__ = "notifications"

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("issues.id"), nullable=True
    )

    pledge_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pledges.id"), nullable=True
    )

    pledge: Mapped[Pledge | None] = relationship(
        "Pledge",
        lazy="joined",
    )

    issue: Mapped[Issue | None] = relationship(
        "Issue",
        lazy="joined",
    )

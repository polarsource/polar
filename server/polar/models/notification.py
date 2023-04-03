from uuid import UUID

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class Notification(RecordModel):
    __tablename__ = "notifications"

    organization_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    event: Mapped[str] = mapped_column(String, nullable=False)

    issue_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=True)
    pledge_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=True)

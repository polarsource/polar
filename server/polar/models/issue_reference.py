from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class IssueReference(TimestampedModel):
    __tablename__ = "issue_references"

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        nullable=False,
        primary_key=True,
    )

    pull_request_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("pull_requests.id"),
        nullable=False,
        primary_key=True,
    )

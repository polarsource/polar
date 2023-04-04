from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest


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

    pull_request_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("pull_requests.id"), nullable=True
    )

    pledge: Mapped[Pledge | None] = relationship(
        "Pledge",
        lazy="joined",
    )

    issue: Mapped[Issue | None] = relationship(
        "Issue",
        lazy="joined",
    )

    pull_request: Mapped[PullRequest | None] = relationship(
        "PullRequest",
        lazy="joined",
    )

    dedup_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)

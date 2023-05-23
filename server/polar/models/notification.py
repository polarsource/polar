from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.types import JSONDict
from sqlalchemy.dialects.postgresql import JSONB


class Notification(RecordModel):
    __tablename__ = "notifications"
    __table_args__ = (
        Index(
            "idx_notifications_user_id",
            "user_id",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(PostgresUUID, nullable=False)
    email_addr: Mapped[str] = mapped_column(String, nullable=False)

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, nullable=True, default=None
    )

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

    payload: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=dict)

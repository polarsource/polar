from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.types import JSONDict


class Notification(RecordModel):
    __tablename__ = "notifications"
    __table_args__ = (
        Index(
            "idx_notifications_user_id",
            "user_id",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=True)
    email_addr: Mapped[str] = mapped_column(String, nullable=True)

    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=True, default=None)

    type: Mapped[str] = mapped_column(String, nullable=False)

    issue_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("issues.id"), nullable=True)

    pledge_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("pledges.id"), nullable=True
    )

    pull_request_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("pull_requests.id"), nullable=True
    )

    payload: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=dict)

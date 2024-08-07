from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class WebhookNotification(RecordModel):
    __tablename__ = "webhook_notifications"

    integration: Mapped[str] = mapped_column(
        String, nullable=False
    )  # "discord" or "slack"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    url: Mapped[str] = mapped_column(
        String, nullable=False
    )  # pre-authenticated delivery string

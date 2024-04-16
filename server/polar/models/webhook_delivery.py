from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import Model
from polar.kit.extensions.sqlalchemy.types import PostgresUUID
from polar.kit.utils import generate_uuid, utc_now
from polar.models.webhook_event import WebhookEvent


class WebhookDelivery(Model):
    __tablename__ = "webhook_deliveries"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID, primary_key=True, default=generate_uuid
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )

    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    webhook_event_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("webhook_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_event(cls) -> Mapped[WebhookEvent]:
        return relationship("WebhookEvent", lazy="raise")

    http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)

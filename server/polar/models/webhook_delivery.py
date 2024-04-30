from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import PostgresUUID
from polar.models.webhook_event import WebhookEvent


class WebhookDelivery(RecordModel):
    __tablename__ = "webhook_deliveries"

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

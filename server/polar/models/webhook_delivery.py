from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .webhook_endpoint import WebhookEndpoint
    from .webhook_event import WebhookEvent


class WebhookDelivery(RecordModel):
    __tablename__ = "webhook_deliveries"

    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_endpoint(cls) -> Mapped["WebhookEndpoint"]:
        return relationship("WebhookEndpoint", lazy="raise")

    webhook_event_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("webhook_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_event(cls) -> Mapped["WebhookEvent"]:
        return relationship("WebhookEvent", lazy="raise")

    http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)

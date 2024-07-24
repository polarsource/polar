from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.models.webhook_endpoint import WebhookEndpoint


class WebhookEvent(RecordModel):
    __tablename__ = "webhook_events"

    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_endpoint(cls) -> Mapped[WebhookEndpoint]:
        return relationship("WebhookEndpoint", lazy="raise")

    last_http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    succeeded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    payload: Mapped[str] = mapped_column(String, nullable=False)

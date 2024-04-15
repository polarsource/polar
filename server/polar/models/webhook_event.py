from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import Model
from polar.kit.extensions.sqlalchemy.types import PostgresUUID
from polar.kit.utils import generate_uuid, utc_now
from polar.models.webhook_endpoint import WebhookEndpoint


class WebhookEvent(Model):
    __tablename__ = "webhook_events"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID, primary_key=True, default=generate_uuid
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )

    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("webhook_endpoints.id"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_endpoint(cls) -> Mapped[WebhookEndpoint]:
        return relationship("WebhookEndpoint", lazy="raise")

    last_http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    succeeded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    payload: Mapped[str] = mapped_column(String, nullable=False)

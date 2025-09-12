from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ColumnElement, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

from .webhook_endpoint import WebhookEventType

if TYPE_CHECKING:
    from .webhook_endpoint import WebhookEndpoint


class WebhookEvent(RecordModel):
    __tablename__ = "webhook_events"
    __table_args__ = (
        Index(
            "ix_webhook_events_created_at_non_archived",
            "created_at",
            postgresql_where="payload IS NOT NULL",
        ),
    )

    webhook_endpoint_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def webhook_endpoint(cls) -> Mapped["WebhookEndpoint"]:
        return relationship("WebhookEndpoint", lazy="raise")

    last_http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    succeeded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    type: Mapped[WebhookEventType] = mapped_column(
        StringEnum(WebhookEventType), nullable=False, index=True
    )
    payload: Mapped[str | None] = mapped_column(String, nullable=True)

    @hybrid_property
    def is_archived(self) -> bool:
        return self.payload is None

    @is_archived.inplace.expression
    @classmethod
    def _is_archived_expression(cls) -> ColumnElement[bool]:
        return cls.payload.is_(None)

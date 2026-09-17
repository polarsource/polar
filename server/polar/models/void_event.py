import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidEvent(RecordModel):
    __tablename__ = "void_events"
    __table_args__ = (
        UniqueConstraint("organization_id", "external_id"),
        Index(
            "ix_void_events_identity_timestamp",
            "organization_id",
            text("(payload ->> 'external_identity_id')"),
            "timestamp",
        ),
        Index(
            "ix_void_events_pending_delivery",
            "organization_id",
            "created_at",
            postgresql_where=text("delivered_at IS NULL"),
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    organization: Mapped["Organization"] = relationship(lazy="raise")

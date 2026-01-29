from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model


class MeterEvent(Model):
    __tablename__ = "meter_events"
    __table_args__ = (
        Index("ix_meter_events_meter_ingested", "meter_id", "ingested_at", "event_id"),
        Index(
            "ix_meter_events_meter_customer_ingested",
            "meter_id",
            "customer_id",
            "ingested_at",
        ),
        Index(
            "ix_meter_events_meter_external_customer_ingested",
            "meter_id",
            "external_customer_id",
            "ingested_at",
        ),
        Index("ix_meter_events_event_id", "event_id"),
    )

    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), primary_key=True
    )
    event_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("events.id", ondelete="cascade"), primary_key=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="set null"), nullable=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    member_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    external_member_id: Mapped[str | None] = mapped_column(String, nullable=True)
    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    ingested_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid, literal_column
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import generate_uuid, utc_now

from .event import EventSource


class EventHyper(Model, MetadataMixin):
    """
    Shadow model for the events_hyper hypertable.
    Used during the dual-write migration period.
    Partitioned by timestamp for efficient chunk exclusion in metrics queries.
    """

    __tablename__ = "events_hyper"
    __table_args__ = (
        Index(
            "ix_events_hyper_external_id",
            "external_id",
            "timestamp",
            unique=True,
            postgresql_where=literal_column("external_id IS NOT NULL"),
        ),
        Index("ix_events_hyper_id", "id"),
        Index(
            "events_hyper_timestamp_idx",
            literal_column("timestamp DESC"),
        ),
        Index(
            "ix_events_hyper_org_timestamp_id",
            "organization_id",
            literal_column("timestamp DESC"),
            "id",
        ),
        Index(
            "ix_events_hyper_org_customer_timestamp",
            "organization_id",
            "customer_id",
            literal_column("timestamp DESC"),
        ),
        Index(
            "ix_events_hyper_org_external_customer_timestamp",
            "organization_id",
            "external_customer_id",
            literal_column("timestamp DESC"),
        ),
        Index(
            "ix_events_hyper_external_customer_pattern",
            "external_customer_id",
            postgresql_ops={"external_customer_id": "text_pattern_ops"},
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=generate_uuid)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, primary_key=True
    )
    ingested_at: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source: Mapped[EventSource] = mapped_column(
        String, nullable=False, default=EventSource.system, index=True
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=True, index=True
    )

    external_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    external_id: Mapped[str | None] = mapped_column(String, nullable=True)

    parent_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, index=True)

    root_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, index=True)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    event_type_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("event_types.id"), nullable=True, index=True
    )

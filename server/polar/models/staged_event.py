import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, BigInteger, Index, String, Uuid, extract
from sqlalchemy import cast as sqla_cast
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import generate_uuid, utc_now
from polar.models.event import EventSource


class StagedEvent(Model, MetadataMixin):
    """Ingested user event waiting to be moved to `events`. Kept lean so ingest
    writes stay cheap: no foreign keys and only the indexes dedup and reducer
    bucket syncs need."""

    __tablename__ = "staged_events"
    __table_args__ = (
        Index(
            "ix_staged_events_organization_id_external_id",
            "organization_id",
            "external_id",
            unique=True,
            postgresql_where="external_id IS NOT NULL",
        ),
        Index(
            "ix_staged_events_organization_id_timestamp", "organization_id", "timestamp"
        ),
        # Every row is deleted soon after it's inserted: vacuum on a fixed number of
        # dead rows, not a share of a table that's usually close to empty.
        {
            "postgresql_with": {
                "autovacuum_vacuum_scale_factor": 0,
                "autovacuum_vacuum_threshold": 10000,
                "autovacuum_vacuum_cost_delay": 0,
            },
        },
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=generate_uuid)
    ingested_at: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )
    timestamp: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[EventSource] = mapped_column(String, nullable=False)
    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    external_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    member_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    external_member_id: Mapped[str | None] = mapped_column(String, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String, nullable=True)
    pending_parent_external_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )
    event_type_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)

    _filterable_fields: dict[str, tuple[type[str | int | bool], Any]] = {
        "timestamp": (int, sqla_cast(extract("epoch", timestamp), BigInteger)),
        "name": (str, name),
        "source": (str, source),
    }

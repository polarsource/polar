from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.meter.aggregation import Aggregation, AggregationType
from polar.meter.filter import Filter, FilterType

if TYPE_CHECKING:
    from .event import Event
    from .organization import Organization


class Meter(RecordModel, MetadataMixin):
    __tablename__ = "meters"

    name: Mapped[str] = mapped_column(String, nullable=False)
    filter: Mapped[Filter] = mapped_column(FilterType, nullable=False)
    aggregation: Mapped[Aggregation] = mapped_column(AggregationType, nullable=False)
    last_billed_event_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True, default=None
    )
    archived_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def last_billed_event(cls) -> Mapped["Event | None"]:
        return relationship("Event", lazy="raise_on_sql")

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

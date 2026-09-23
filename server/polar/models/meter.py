from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.metadata import MetadataMixin
from polar.meter.aggregation import Aggregation, AggregationType
from polar.meter.filter import Filter, FilterType
from polar.meter.unit import MeterUnit

if TYPE_CHECKING:
    from .event import Event
    from .organization import Organization
    from .void_deployment import VoidDeployment
    from .void_reducer import VoidReducer


class Meter(RecordModel, MetadataMixin):
    __tablename__ = "meters"

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", "version_id"),
        ForeignKeyConstraint(
            ["organization_id", "usage_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
        ForeignKeyConstraint(
            ["organization_id", "credit_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
    )
    slug: Mapped[str] = mapped_column(String, nullable=True)
    version_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    deployment_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("void_deployments.id"), nullable=True
    )
    usage_reducer_id: Mapped[UUID] = mapped_column(Uuid, nullable=True, index=True)
    credit_reducer_id: Mapped[UUID] = mapped_column(Uuid, nullable=True, index=True)
    deployment: Mapped["VoidDeployment"] = relationship(lazy="raise")
    usage_reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[usage_reducer_id], lazy="raise"
    )
    credit_reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[credit_reducer_id], lazy="raise"
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    unit: Mapped[MeterUnit] = mapped_column(
        StringEnum(MeterUnit), nullable=False, default=MeterUnit.scalar
    )
    custom_label: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    custom_multiplier: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
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

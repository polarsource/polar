from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.meter.aggregation import Aggregation, AggregationType
from polar.meter.filter import Filter, FilterType

if TYPE_CHECKING:
    from .organization import Organization


class Meter(RecordModel, MetadataMixin):
    __tablename__ = "meters"

    name: Mapped[str] = mapped_column(String, nullable=False)
    filter: Mapped[Filter] = mapped_column(FilterType, nullable=False)
    aggregation: Mapped[Aggregation] = mapped_column(AggregationType, nullable=False)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

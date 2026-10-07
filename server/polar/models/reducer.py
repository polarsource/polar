from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now
from polar.meter.aggregation import Aggregation, AggregationType
from polar.meter.filter import Filter, FilterType

if TYPE_CHECKING:
    from .meter_reducer import MeterReducer
    from .organization import Organization


class Reducer(RecordModel):
    __tablename__ = "reducers"

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    filter: Mapped[Filter] = mapped_column(FilterType, nullable=False)
    aggregation: Mapped[Aggregation] = mapped_column(AggregationType, nullable=False)

    organization: Mapped["Organization"] = relationship(lazy="raise")
    meter_reducers: Mapped[list["MeterReducer"]] = relationship(
        lazy="raise", back_populates="reducer", passive_deletes="all"
    )

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import Model

if TYPE_CHECKING:
    from .meter import Meter
    from .reducer import Reducer


class MeterReducer(Model):
    __tablename__ = "meter_reducers"

    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), primary_key=True
    )
    reducer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("reducers.id", ondelete="cascade"),
        primary_key=True,
        index=True,
    )

    meter: Mapped["Meter"] = relationship(lazy="raise")
    reducer: Mapped["Reducer"] = relationship(
        lazy="raise", back_populates="meter_reducers"
    )

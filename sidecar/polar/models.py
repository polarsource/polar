from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from polar.db import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(unique=True)
    body: Mapped[dict[str, Any]] = mapped_column(JSON)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    polar_event_id: Mapped[str | None] = mapped_column(unique=True)


class CustomerMeter(Base):
    """A cached snapshot of an upstream customer meter, refreshed on poll/read.

    The structured columns drive identity, event matching and the local delta; the
    `snapshot` blob is the raw upstream response, replayed verbatim (with the delta
    merged in) when Polar is unreachable.
    """

    __tablename__ = "customer_meters"
    __table_args__ = (UniqueConstraint("customer_id", "meter_id"),)

    id: Mapped[str] = mapped_column(primary_key=True)
    customer_id: Mapped[str]
    meter_id: Mapped[str]
    external_customer_id: Mapped[str | None]
    filter: Mapped[dict[str, Any]] = mapped_column(JSON)
    aggregation: Mapped[dict[str, Any]] = mapped_column(JSON)
    consumed_units: Mapped[float]
    credited_units: Mapped[int]
    balance: Mapped[float]
    last_balanced_event_id: Mapped[str | None]
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    polled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from polar.meter.aggregation import AggregationFunction


@dataclass(frozen=True)
class UsageWindow:
    interval_id: UUID
    source_subscription_id: UUID
    meter_id: UUID
    start: datetime
    end: datetime


@dataclass(frozen=True)
class UsageSummary:
    count: int
    total: Decimal
    minimum: Decimal | None
    maximum: Decimal | None


@dataclass(frozen=True)
class WindowUsage:
    window: UsageWindow
    summary: UsageSummary


@dataclass(frozen=True)
class MeterUsage:
    function: AggregationFunction
    windows: tuple[WindowUsage, ...]
    credits: Decimal

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


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

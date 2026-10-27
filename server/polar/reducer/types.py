from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from polar.meter.aggregation import AggregationFunction

type UsageAggregation = Literal[
    AggregationFunction.cnt,
    AggregationFunction.sum,
    AggregationFunction.min,
    AggregationFunction.max,
    AggregationFunction.avg,
]


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
    """The opaque key covers bucket identities, generations, boundaries and summaries."""

    window: UsageWindow
    summary: UsageSummary
    observation_key: str


@dataclass(frozen=True)
class UsageDefinition:
    """Identifies the retained, frozen reducer definition used for a meter."""

    meter_id: UUID
    reducer_id: UUID
    aggregation: UsageAggregation


@dataclass(frozen=True)
class ObservedUsage:
    windows: tuple[WindowUsage, ...]
    observed_at: datetime
    definitions: tuple[UsageDefinition, ...]
    kind: Literal["observed"] = "observed"


type UsageIncompleteReason = Literal[
    "missing_history",
    "boundary_unavailable",
    "unsupported_ownership",
    "unsupported_reducer_mapping",
    "unsupported_aggregation",
]


@dataclass(frozen=True)
class IncompleteUsage:
    reason: UsageIncompleteReason
    kind: Literal["incomplete"] = "incomplete"


type UsageResult = ObservedUsage | IncompleteUsage

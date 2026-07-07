import abc
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from zoneinfo import ZoneInfo

from polar.metrics.schemas import MetricsResponse

from ..keys import build_insight_key
from ..schemas import (
    ConfidenceLevel,
    Insight,
    InsightAction,
    InsightCategory,
    InsightDriver,
    InsightSeverity,
)
from ..signals import CustomerCostSignal, ProductPricing

# Minimum population before an insight is trustworthy enough to surface at all.
_MIN_SAMPLE = 5
_MEDIUM_SAMPLE = 20
_HIGH_SAMPLE = 100


def confidence_for_sample(sample_n: int) -> ConfidenceLevel | None:
    """Map a sample size to a confidence level, or None to suppress entirely."""
    if sample_n < _MIN_SAMPLE:
        return None
    if sample_n < _MEDIUM_SAMPLE:
        return ConfidenceLevel.low
    if sample_n < _HIGH_SAMPLE:
        return ConfidenceLevel.medium
    return ConfidenceLevel.high


@dataclass(frozen=True)
class DetectorContext:
    """Everything a detector needs to read the business for one organization.

    The service prefetches a single metrics window per organization — the union
    of every selected detector's `metric_slugs` over the longest lookback — so
    detectors never touch the database: signals in, insight out.
    """

    organization_id: uuid.UUID
    timezone: ZoneInfo
    today: date
    metrics: MetricsResponse
    products: Sequence[ProductPricing] = ()
    """Per-product pricing + metrics windows. Prefetched only when a selected
    detector declares `product_metric_slugs` and the organization has cost data."""
    customer_costs: Sequence[CustomerCostSignal] = ()
    """Customers ranked by tracked cost over the window. Prefetched only when a
    selected detector declares `needs_customer_costs`."""


class Detector(abc.ABC):
    """
    A single rule that reads metric signals and may emit one insight.

    Detectors are deterministic and pure given their context, which keeps them
    trivially unit-testable: feed a `MetricsResponse`, assert the `Insight`.
    """

    id: str
    category: InsightCategory
    category_label: str
    priority: int = 100
    """Tie-break within a severity band: lower surfaces first, then confidence.
    The primary feed order is each insight's `severity`, set per finding."""
    metric_slugs: Sequence[str] = ()
    """Metric slugs this detector reads. The service prefetches their union."""
    product_metric_slugs: Sequence[str] = ()
    """Metric slugs this detector reads *per product*. When any selected
    detector declares these, the service also fetches them filtered to each of
    the organization's products (capped, and only when org-level cost data
    exists) into `ctx.products`."""
    needs_customer_costs: bool = False
    """When true, the service prefetches `ctx.customer_costs` (per-customer
    cost ranking from the events statistics)."""
    lookback_days: int = 30
    """History `evaluate` needs. The service fetches the longest lookback."""

    @abc.abstractmethod
    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        """Return an insight if this detector fires for the org, else None."""
        ...

    def build_insight(
        self,
        ctx: DetectorContext,
        *,
        period_bucket: str,
        severity: InsightSeverity,
        title: str,
        body: str,
        confidence: ConfidenceLevel,
        why: str | None = None,
        primary_action: InsightAction | None = None,
        drivers: list[InsightDriver] | None = None,
    ) -> Insight:
        return Insight(
            id=build_insight_key(self.id, ctx.organization_id, period_bucket),
            detector_id=self.id,
            category=self.category,
            category_label=self.category_label,
            severity=severity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=primary_action,
            drivers=drivers or [],
        )

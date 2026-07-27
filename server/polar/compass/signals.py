"""
Signal layer: turns metrics into the uniform inputs (`MetricSignal`) detectors
reason over.

The source is always the `metrics` service (Postgres + Tinybird); this module is
only about *how* a metric's current-vs-baseline shape is derived from it. Today
we read a window of periods and diff them in Python. A later optimization could
have parameterized Tinybird pipes return value + baseline + drivers directly in
one columnar query instead, avoiding the Python diffing — same data, computed
server-side. Because detectors depend only on `MetricSignal`, that swap is a
signals-layer change, not a detector change.

The per-period readers (`series`, `latest`, …) live in `polar.metrics.aggregation`.
"""

import uuid
from dataclasses import dataclass, field
from enum import StrEnum

from polar.metrics.schemas import MetricsResponse


class DriverDimension(StrEnum):
    """What a driver breakdown is grouped by (e.g. per product)."""

    product = "product"


@dataclass(frozen=True)
class MetricSignal:
    """A metric's current value against a baseline, plus a sample size."""

    slug: str
    current: float
    baseline: float
    sample_n: int
    """Population behind the change (e.g. active subscriptions), for confidence."""
    drivers_dimension: DriverDimension | None = None
    drivers: list[tuple[str, float]] = field(default_factory=list)
    """(label, contribution) pairs; empty until a breakdown pipe is wired in."""

    @property
    def delta_abs(self) -> float:
        return self.current - self.baseline

    @property
    def delta_pct(self) -> float | None:
        if self.baseline == 0:
            return None
        return (self.current - self.baseline) / abs(self.baseline)


@dataclass(frozen=True)
class ProductPricing:
    """A product's current list price plus its product-filtered metrics window.

    Prefetched by the service for detectors that declare `product_metric_slugs`,
    so per-product detectors stay pure: pricing + signals in, insight out.
    """

    product_id: uuid.UUID
    name: str
    price_amount: int
    """Current list price in cents."""
    currency: str
    metrics: MetricsResponse
    """The same metrics window as the organization's, scoped to this product:
    revenue metrics filtered by product, cost metrics by its active-customer
    cohort (cost events attach to customers, not products)."""


# How many cost-ranked customers the service prefetches. Covers the highest
# confidence threshold (see `confidence_for_sample`), so the cost-bearing
# customer count is exact up to this depth; at the cap the copy says
# "at least".
CUSTOMER_COSTS_SAMPLE_LIMIT = 100


@dataclass(frozen=True)
class CustomerCostSignal:
    """One customer's share of tracked costs over the window.

    Prefetched by the service (from the events `by-customer` statistics) for
    detectors that declare `needs_customer_costs`, keeping them pure.
    """

    label: str
    """Customer email, name or external id — whatever identifies them best."""
    amount: float
    """Total `_cost.amount` over the window, in the merchant's cost unit."""
    share: float
    """This customer's share of all tracked costs (0-1)."""


@dataclass(frozen=True)
class ChurnBreakdown:
    """Ended subscriptions in the window, split by why they ended.

    Involuntary means the platform ended the subscription (payment failure,
    dunning exhaustion); voluntary means the customer chose to cancel.
    """

    voluntary: int
    involuntary: int

    @property
    def total(self) -> int:
        return self.voluntary + self.involuntary


@dataclass(frozen=True)
class CurrencyOpportunitySignal:
    """Paid revenue attributable to a presentment currency the merchant does
    not price in, derived from order billing countries."""

    currency: str
    """Lowercase ISO currency code, e.g. `eur`."""
    revenue_share: float
    """Share of the window's total paid revenue from this currency's countries."""
    order_count: int
    countries: tuple[str, ...]
    """Top contributing alpha-2 country codes, largest first."""


@dataclass(frozen=True)
class CostAnomalySignal:
    """Outlier cost traces for one event name, aggregated from the events
    variance statistics (root events at or above the p99 cost for their name).

    Prefetched by the service for detectors that declare `needs_cost_anomalies`,
    keeping them pure.
    """

    event_name: str
    anomaly_count: int
    """Number of outlier traces for this event name in the window."""
    total_amount: float
    """Summed `_cost.amount` across the outlier traces, in cents (the
    documented unit of `_cost.amount`; fractional cents allowed)."""
    max_amount: float
    """The single largest outlier trace's cost, in cents."""
    max_event_id: uuid.UUID
    """Root event id of that largest trace, for a deep-link to its span."""
    average_amount: float
    """Typical per-trace cost for this event name, in cents."""

    @property
    def spike_ratio(self) -> float:
        """How many times the largest outlier exceeds the typical trace.

        A p99 outlier always exists, so this magnitude — not membership — is
        what makes a spike newsworthy.
        """
        if self.average_amount <= 0:
            return 0.0
        return self.max_amount / self.average_amount


def format_currency(cents: float) -> str:
    return f"${cents / 100:,.0f}"


def format_pct(fraction: float) -> str:
    return f"{abs(fraction) * 100:.0f}%"

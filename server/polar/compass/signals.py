"""
Signal layer: turns the metrics API into the uniform inputs detectors reason over.

In the target architecture these come straight from parameterized Tinybird pipes
that return value + baseline + drivers in one fast columnar query. For the scaffold
we compute them by reading the existing `metrics` service (which already merges
Postgres + Tinybird, and handles auth, filtering and caching) over a window, then
diffing periods in Python. Detectors depend only on `MetricSignal`, so swapping in
dedicated pipes later is a signals-layer change, not a detector change.

The per-period readers (`series`, `latest`, …) live on `MetricsResponse` in the
metrics module, so they're reusable by any metrics consumer, not just Compass.
"""

from dataclasses import dataclass, field
from enum import StrEnum


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


def format_currency(cents: float) -> str:
    return f"${cents / 100:,.0f}"


def format_pct(fraction: float) -> str:
    return f"{abs(fraction) * 100:.0f}%"

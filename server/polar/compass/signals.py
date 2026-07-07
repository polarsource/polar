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

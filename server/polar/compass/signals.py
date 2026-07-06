"""
Signal layer: turns the metrics API into the uniform inputs detectors reason over.

In the target architecture these come straight from parameterized Tinybird pipes
that return value + baseline + drivers in one fast columnar query. For the scaffold
we compute them by reading the existing `metrics` service (which already merges
Postgres + Tinybird, and handles auth, filtering and caching) over a window, then
diffing periods in Python. Detectors depend only on `MetricSignal`, so swapping in
dedicated pipes later is a signals-layer change, not a detector change.
"""

from dataclasses import dataclass, field

from polar.metrics.schemas import MetricsResponse


@dataclass(frozen=True)
class MetricSignal:
    """A metric's current value against a baseline, plus a sample size."""

    slug: str
    current: float
    baseline: float
    sample_n: int
    """Population behind the change (e.g. active subscriptions), for confidence."""
    drivers_dimension: str | None = None
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


def series(response: MetricsResponse, slug: str) -> list[float]:
    """Ordered per-period values for a metric slug (periods are already sorted)."""
    return [getattr(p, slug, None) or 0 for p in response.periods]


def latest(response: MetricsResponse, slug: str) -> float:
    values = series(response, slug)
    return values[-1] if values else 0


def value_n_periods_ago(response: MetricsResponse, slug: str, n: int) -> float | None:
    """The value `n` periods before the latest, or None if the window is too short."""
    values = series(response, slug)
    index = len(values) - 1 - n
    if index < 0:
        return None
    return values[index]


def sum_last_n_periods(response: MetricsResponse, slug: str, n: int) -> float:
    """Total of a metric over the most recent `n` periods (a rolling window)."""
    return sum(series(response, slug)[-n:])


def format_currency(cents: float) -> str:
    return f"${cents / 100:,.0f}"


def format_pct(fraction: float) -> str:
    return f"{abs(fraction) * 100:.0f}%"

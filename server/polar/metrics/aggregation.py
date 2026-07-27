"""Read per-period values out of a `MetricsResponse`.

Small, dependency-free accessors kept next to the metrics module (rather than on
the response schema itself) so any metrics consumer can reuse them without the
response class carrying behavior.
"""

from .schemas import MetricsResponse


def series(response: MetricsResponse, slug: str) -> list[float]:
    """Ordered per-period values for a metric slug (periods are already sorted)."""
    return [getattr(period, slug, None) or 0 for period in response.periods]


def latest(response: MetricsResponse, slug: str) -> float:
    """The most recent period's value for a metric slug, or 0 if empty."""
    values = series(response, slug)
    return values[-1] if values else 0


def value_n_periods_ago(response: MetricsResponse, slug: str, n: int) -> float | None:
    """The value `n` periods before the latest, or None if the window is too short."""
    values = series(response, slug)
    index = len(values) - 1 - n
    return values[index] if index >= 0 else None


def sum_last_n_periods(response: MetricsResponse, slug: str, n: int) -> float:
    """Total of a metric over the most recent `n` periods (a rolling window)."""
    return sum(series(response, slug)[-n:])

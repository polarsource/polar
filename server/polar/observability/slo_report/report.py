"""Data models for SLO report."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class EndpointSLOStatus:
    """SLO status for a single endpoint."""

    endpoint: str
    method: str
    p99_target: float  # seconds
    p99_actual: float | None  # seconds, None if no data
    availability_target: float  # percentage
    availability_actual: float | None  # percentage, None if no data
    request_count: int
    error_count: int

    @property
    def p99_passing(self) -> bool:
        if self.p99_actual is None:
            return True  # No data = passing
        return self.p99_actual <= self.p99_target

    @property
    def availability_passing(self) -> bool:
        if self.availability_actual is None:
            return True
        return self.availability_actual >= self.availability_target

    @property
    def is_passing(self) -> bool:
        return self.p99_passing and self.availability_passing


@dataclass
class SLOReport:
    """Weekly SLO report data."""

    period_start: datetime
    period_end: datetime
    environment: str

    # Global metrics
    global_availability: float  # percentage
    error_budget_remaining: float  # percentage (0-100)
    total_requests: int
    total_errors: int

    # Per-endpoint status
    endpoints: list[EndpointSLOStatus]

    @property
    def endpoints_passing(self) -> int:
        return sum(1 for e in self.endpoints if e.is_passing)

    @property
    def endpoints_failing(self) -> int:
        return len(self.endpoints) - self.endpoints_passing

    @property
    def overall_status(self) -> str:
        if self.endpoints_failing == 0:
            return "healthy"
        elif self.endpoints_failing <= 1:
            return "degraded"
        else:
            return "critical"

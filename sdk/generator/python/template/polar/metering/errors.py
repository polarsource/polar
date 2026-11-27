from __future__ import annotations

import dataclasses
import math
import typing

import httpx2

from polar._errors import PolarError
if typing.TYPE_CHECKING:
    from polar.metering.events import EventInput


class MeteringError(PolarError):
    """Base error for metering configuration and operations."""


class IngestRetryableError(MeteringError):
    """Delivery failed or its outcome is uncertain."""

    def __init__(
        self, message: str = "Event delivery can be retried", *, retry_after: float | None = None
    ) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class IngestRejectedError(MeteringError):
    """Polar permanently refused the batch or the supplied zero-based event indexes."""

    def __init__(
        self, message: str = "Event delivery was rejected", *, rejected_indexes: set[int] | None = None
    ) -> None:
        super().__init__(message)
        self.rejected_indexes = rejected_indexes


def retry_after_seconds(retry_after: int | None) -> float | None:
    """How long Polar asked to wait before the next delivery: a second at least."""
    return None if retry_after is None else max(float(retry_after), 1.0)


def retry_after_response(response: httpx2.Response | None) -> float | None:
    if response is None or response.status_code != 429:
        return None
    retry_after = response.headers.get("Retry-After")
    if not retry_after or not retry_after.isdecimal():
        return None
    return retry_after_seconds(int(retry_after))


class UnknownMeterError(MeteringError):
    """Raised when a strategy cannot read the meter."""


DropReason = typing.Literal[
    "retry_exhausted", "shutdown_timeout", "permanent_error", "worker_error"
]


@dataclasses.dataclass
class DeliveryFailure:
    """Unconfirmed events, their delivery outcome, and its original cause."""

    events: list[EventInput]
    reason: DropReason
    cause: BaseException


class MeteringDeliveryError(MeteringError):
    """Raised when queued events could not be confirmed by Polar."""

    def __init__(self, failures: list[DeliveryFailure]) -> None:
        self.failures = failures
        self.events = [event for failure in failures for event in failure.events]
        cause = failures[0].cause if failures else None
        super().__init__(f"Could not confirm delivery of {len(self.events)} events")
        self.__cause__ = cause


class MeteringTimeoutError(MeteringError, TimeoutError):
    """The caller's delivery wait expired; background delivery is not cancelled."""

    def __init__(self, timeout: float) -> None:
        self.timeout = timeout
        super().__init__(f"Metering flush timed out after {timeout:g}s")


def validate_timeout(timeout: float) -> None:
    if not math.isfinite(timeout) or timeout < 0:
        raise ValueError("Metering timeout must be finite and non-negative")

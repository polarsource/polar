import dataclasses
import math
import typing

from polar import PolarError
from polar.metering.events import EventInput


class MeteringError(PolarError):
    """Base error for metering configuration and operations."""


class InvalidActorError(MeteringError):
    """Raised when customer or member identifiers are inconsistent."""


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

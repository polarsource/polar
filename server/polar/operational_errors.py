"""Module to handle operational errors in a structured way."""

import traceback
from collections.abc import Callable

import sentry_sdk
import structlog

from polar.logging import Logger
from polar.observability import OPERATIONAL_ERROR_TOTAL

log: Logger = structlog.get_logger()


type OperationalErrorMatcher = Callable[[BaseException], bool]


def _sql_timeout_error_matcher(exc: BaseException) -> bool:
    """Match TimeoutError from asyncpg database queries.

    These errors occur when database queries exceed the configured timeout.
    They originate from asyncpg/protocol/protocol.pyx and propagate through
    SQLAlchemy's exception handling chain.
    """
    if not isinstance(exc, TimeoutError):
        return False

    tb_lines = traceback.format_exception(type(exc), exc, exc.__traceback__)
    tb_str = "".join(tb_lines)

    return "asyncpg/protocol/protocol.pyx" in tb_str


def _external_event_already_handled_error_matcher(exc: BaseException) -> bool:
    # Import deferred to avoid circular dependency with polar.worker
    from polar.external_event.service import ExternalEventAlreadyHandled

    return isinstance(exc, ExternalEventAlreadyHandled)


def _loops_client_operational_error_matcher(exc: BaseException) -> bool:
    # Import deferred to avoid circular dependency with polar.worker
    from polar.integrations.loops.client import LoopsClientOperationalError

    return isinstance(exc, LoopsClientOperationalError)


_operation_error_matchers: dict[str, OperationalErrorMatcher] = {
    "sql_timeout_error": _sql_timeout_error_matcher,
    "external_event_already_handled": _external_event_already_handled_error_matcher,
    "loops_client_operational_error": _loops_client_operational_error_matcher,
}


def handle_operational_error(exc: BaseException) -> bool:
    """
    Check if the given exception matches any known operational error patterns.
    If a match is found, log the error and increment the corresponding Prometheus counter.

    Args:
        exc: The exception to check.

    Returns:
        True if the exception was identified as an operational error, False otherwise.

    """
    for type, matcher in _operation_error_matchers.items():
        if matcher(exc):
            log.warning("Operational error detected", error=str(exc), type=type)
            OPERATIONAL_ERROR_TOTAL.labels(type=type).inc()
            sentry_sdk.set_level("warning")
            sentry_sdk.set_tag("is_operational_error", "true")
            return True

    return False

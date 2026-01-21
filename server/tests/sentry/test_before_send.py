"""Tests for Sentry before_send filtering logic."""

from typing import Any

import pytest

from polar.sentry import (
    _LOCK_EXPECTED_ACTORS,
    _get_dramatiq_actor_name,
    _is_lock_not_available_error,
    before_send,
)


class MockLockNotAvailableError(Exception):
    """Mock asyncpg LockNotAvailableError."""

    sqlstate = "55P03"


# Rename the class so it matches what the code checks for
MockLockNotAvailableError.__name__ = "LockNotAvailableError"


class MockAsyncAdaptError(Exception):
    """Mock SQLAlchemy's asyncpg adapter error wrapper."""

    def __init__(self, cause: Exception) -> None:
        self.__cause__ = cause


class MockDBAPIError(Exception):
    """Mock SQLAlchemy DBAPIError that wraps asyncpg errors."""

    def __init__(self, orig: Exception) -> None:
        self.orig = orig


# Rename to match what the code checks
MockDBAPIError.__name__ = "DBAPIError"


class TestIsLockNotAvailableError:
    """Tests for _is_lock_not_available_error function."""

    def test_direct_lock_not_available_error(self) -> None:
        """Should detect direct asyncpg LockNotAvailableError by class name."""
        exc = MockLockNotAvailableError()
        assert _is_lock_not_available_error(exc) is True

    def test_wrapped_in_dbapi_error(self) -> None:
        """Should detect LockNotAvailableError wrapped in SQLAlchemy DBAPIError."""
        # Create the chain: DBAPIError -> orig -> __cause__ (with sqlstate)
        lock_error = MockLockNotAvailableError()
        adapter_error = MockAsyncAdaptError(lock_error)
        dbapi_error = MockDBAPIError(adapter_error)

        assert _is_lock_not_available_error(dbapi_error) is True

    def test_other_exception(self) -> None:
        """Should return False for non-lock errors."""
        exc = ValueError("some other error")
        assert _is_lock_not_available_error(exc) is False

    def test_dbapi_error_with_different_sqlstate(self) -> None:
        """Should return False for DBAPIError with different sqlstate."""

        class OtherPostgresError(Exception):
            sqlstate = "23505"  # unique_violation

        other_error = OtherPostgresError()
        adapter_error = MockAsyncAdaptError(other_error)
        dbapi_error = MockDBAPIError(adapter_error)

        assert _is_lock_not_available_error(dbapi_error) is False

    def test_dbapi_error_without_cause(self) -> None:
        """Should return False for DBAPIError without __cause__."""

        class NoChainAdapter(Exception):
            pass

        adapter_error = NoChainAdapter()
        dbapi_error = MockDBAPIError(adapter_error)

        assert _is_lock_not_available_error(dbapi_error) is False


class TestGetDramatiqActorName:
    """Tests for _get_dramatiq_actor_name function."""

    def test_extracts_actor_name(self) -> None:
        """Should extract actor_name from dramatiq context."""
        event: dict[str, Any] = {
            "contexts": {
                "dramatiq": {
                    "data": {
                        "actor_name": "customer_meter.update_customer",
                        "message_id": "abc123",
                    }
                }
            }
        }
        assert _get_dramatiq_actor_name(event) == "customer_meter.update_customer"

    def test_no_contexts(self) -> None:
        """Should return None if no contexts."""
        event: dict[str, Any] = {}
        assert _get_dramatiq_actor_name(event) is None

    def test_no_dramatiq_context(self) -> None:
        """Should return None if no dramatiq context."""
        event: dict[str, Any] = {"contexts": {"other": {}}}
        assert _get_dramatiq_actor_name(event) is None

    def test_no_data_in_dramatiq(self) -> None:
        """Should return None if no data in dramatiq context."""
        event: dict[str, Any] = {"contexts": {"dramatiq": {}}}
        assert _get_dramatiq_actor_name(event) is None

    def test_no_actor_name_in_data(self) -> None:
        """Should return None if no actor_name in data."""
        event: dict[str, Any] = {"contexts": {"dramatiq": {"data": {"other": "value"}}}}
        assert _get_dramatiq_actor_name(event) is None

    def test_dramatiq_context_not_dict(self) -> None:
        """Should return None if dramatiq context is not a dict."""
        event: dict[str, Any] = {"contexts": {"dramatiq": "not a dict"}}
        assert _get_dramatiq_actor_name(event) is None

    def test_data_not_dict(self) -> None:
        """Should return None if data is not a dict."""
        event: dict[str, Any] = {"contexts": {"dramatiq": {"data": "not a dict"}}}
        assert _get_dramatiq_actor_name(event) is None


class TestBeforeSend:
    """Tests for before_send Sentry hook."""

    def _make_event(self, actor_name: str | None = None) -> dict[str, Any]:
        """Create a mock Sentry event."""
        if actor_name is None:
            return {}
        return {
            "contexts": {
                "dramatiq": {
                    "data": {
                        "actor_name": actor_name,
                    }
                }
            }
        }

    def _make_hint(self, exc: Exception | None = None) -> dict[str, Any]:
        """Create a mock Sentry hint with exception info."""
        if exc is None:
            return {}
        return {"exc_info": (type(exc), exc, None)}

    def test_filters_lock_error_for_expected_actor(self) -> None:
        """Should filter LockNotAvailableError for actors in _LOCK_EXPECTED_ACTORS."""
        exc = MockLockNotAvailableError()
        event = self._make_event("customer_meter.update_customer")
        hint = self._make_hint(exc)

        result = before_send(event, hint)

        assert result is None  # Event should be dropped

    def test_does_not_filter_lock_error_for_other_actor(self) -> None:
        """Should NOT filter LockNotAvailableError for actors not in _LOCK_EXPECTED_ACTORS."""
        exc = MockLockNotAvailableError()
        event = self._make_event("some_other.task")
        hint = self._make_hint(exc)

        result = before_send(event, hint)

        assert result is event  # Event should be sent

    def test_does_not_filter_lock_error_without_dramatiq_context(self) -> None:
        """Should NOT filter LockNotAvailableError if not in dramatiq context."""
        exc = MockLockNotAvailableError()
        event = self._make_event(None)  # No dramatiq context
        hint = self._make_hint(exc)

        result = before_send(event, hint)

        assert result is event  # Event should be sent

    def test_does_not_filter_other_exceptions(self) -> None:
        """Should NOT filter non-lock exceptions."""
        exc = ValueError("some error")
        event = self._make_event("customer_meter.update_customer")
        hint = self._make_hint(exc)

        result = before_send(event, hint)

        assert result is event  # Event should be sent

    def test_passes_through_events_without_exception(self) -> None:
        """Should pass through events without exception info."""
        event = self._make_event("customer_meter.update_customer")
        hint: dict[str, Any] = {}

        result = before_send(event, hint)

        assert result is event  # Event should be sent

    def test_filters_wrapped_dbapi_error_for_expected_actor(self) -> None:
        """Should filter wrapped DBAPIError for actors in _LOCK_EXPECTED_ACTORS."""
        lock_error = MockLockNotAvailableError()
        adapter_error = MockAsyncAdaptError(lock_error)
        dbapi_error = MockDBAPIError(adapter_error)

        event = self._make_event("customer_meter.update_customer")
        hint = self._make_hint(dbapi_error)

        result = before_send(event, hint)

        assert result is None  # Event should be dropped


class TestLockExpectedActors:
    """Tests for _LOCK_EXPECTED_ACTORS configuration."""

    def test_contains_customer_meter_update(self) -> None:
        """Should contain customer_meter.update_customer task."""
        assert "customer_meter.update_customer" in _LOCK_EXPECTED_ACTORS

    def test_is_frozenset(self) -> None:
        """Should be a frozenset (immutable)."""
        assert isinstance(_LOCK_EXPECTED_ACTORS, frozenset)

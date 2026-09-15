import asyncio
from collections.abc import Sequence
from typing import Any, Self
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.transaction.diagnostics import PayoutQueryDiagnostics


class _FakeMappings:
    def __init__(self, rows: Sequence[dict[str, Any]]) -> None:
        self._rows = list(rows)

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None

    def __iter__(self) -> Any:
        return iter(self._rows)


class _FakeResult:
    def __init__(self, rows: Sequence[dict[str, Any]]) -> None:
        self._rows = list(rows)

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _FakeConnection:
    def __init__(self, results: Sequence[_FakeResult]) -> None:
        self._results = list(results)
        self.executed_params: list[Any] = []

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *args: object) -> bool:
        return False

    async def execute(self, statement: Any, params: Any = None) -> _FakeResult:
        self.executed_params.append(params)
        return self._results.pop(0)


class _FakeEngine:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection
        self.connect_calls = 0

    def connect(self) -> _FakeConnection:
        self.connect_calls += 1
        return self.connection


def _enable(mocker: MockerFixture, *, delay: float = 0.0) -> None:
    mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_ENABLED", True)
    mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_DELAY_SECONDS", delay)
    mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_MAX_BLOCKERS", 5)


_ACTIVITY_ROW = {
    "state": "active",
    "wait_event_type": "Lock",
    "wait_event": "transactionid",
    "backend_type": "client backend",
    "query_age_seconds": 12.5,
    "xact_age_seconds": 30.0,
    "blocking_pids": [4242],
}


@pytest.mark.asyncio
class TestWatch:
    async def test_disabled_is_noop(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_ENABLED", False)
        diagnostics = PayoutQueryDiagnostics()
        sample = mocker.patch.object(diagnostics, "_sample_when_slow")

        async with diagnostics.watch(
            backend_pid=1234, span=MagicMock(), phase="update_batch"
        ):
            pass

        sample.assert_not_called()

    async def test_missing_backend_pid_is_noop(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        sample = mocker.patch.object(diagnostics, "_sample_when_slow")

        async with diagnostics.watch(
            backend_pid=None, span=MagicMock(), phase="update_batch"
        ):
            pass

        sample.assert_not_called()

    async def test_fast_query_does_not_sample(self, mocker: MockerFixture) -> None:
        # A long delay means a query that completes quickly is cancelled while
        # the watchdog is still sleeping: no sampling connection is opened.
        _enable(mocker, delay=100.0)
        diagnostics = PayoutQueryDiagnostics()
        sample_once = mocker.patch.object(diagnostics, "_sample_once", new=AsyncMock())

        async with diagnostics.watch(
            backend_pid=1234, span=MagicMock(), phase="update_batch"
        ):
            await asyncio.sleep(0)

        sample_once.assert_not_awaited()

    async def test_slow_query_samples_from_distinct_connection(
        self, mocker: MockerFixture
    ) -> None:
        _enable(mocker, delay=0.0)
        diagnostics = PayoutQueryDiagnostics()
        connection = _FakeConnection([_FakeResult([_ACTIVITY_ROW]), _FakeResult([])])
        engine = _FakeEngine(connection)
        mocker.patch.object(
            diagnostics, "_get_engine", new=AsyncMock(return_value=engine)
        )
        span = MagicMock()

        async with diagnostics.watch(
            backend_pid=1234, span=span, phase="update_batch", batch_ordinal=2
        ):
            for _ in range(100):
                if span.set_attributes.called:
                    break
                await asyncio.sleep(0.01)

        assert span.set_attributes.called
        assert engine.connect_calls >= 1

    async def test_sampling_failure_does_not_propagate(
        self, mocker: MockerFixture
    ) -> None:
        _enable(mocker, delay=0.0)
        diagnostics = PayoutQueryDiagnostics()
        mocker.patch.object(
            diagnostics,
            "_sample_once",
            new=AsyncMock(side_effect=RuntimeError("boom")),
        )
        warn = mocker.patch("polar.transaction.diagnostics.log.warning")

        async with diagnostics.watch(
            backend_pid=1234, span=MagicMock(), phase="update_batch"
        ):
            await asyncio.sleep(0.02)

        warn.assert_called()

    async def test_original_error_is_not_masked(self, mocker: MockerFixture) -> None:
        _enable(mocker, delay=100.0)
        diagnostics = PayoutQueryDiagnostics()
        mocker.patch.object(diagnostics, "_sample_once", new=AsyncMock())

        with pytest.raises(ValueError, match="query failed"):
            async with diagnostics.watch(
                backend_pid=1234, span=MagicMock(), phase="update_batch"
            ):
                raise ValueError("query failed")

    async def test_cancellation_is_clean(self, mocker: MockerFixture) -> None:
        _enable(mocker, delay=100.0)
        diagnostics = PayoutQueryDiagnostics()
        sample_once = mocker.patch.object(diagnostics, "_sample_once", new=AsyncMock())

        with pytest.raises(asyncio.CancelledError):
            async with diagnostics.watch(
                backend_pid=1234, span=MagicMock(), phase="update_batch"
            ):
                raise asyncio.CancelledError()

        sample_once.assert_not_awaited()


@pytest.mark.asyncio
class TestSampleOnce:
    async def test_snapshot_is_allowlisted(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        blocker_row = {
            "pid": 4242,
            "state": "active",
            "wait_event_type": None,
            "wait_event": None,
            "backend_type": "client backend",
            "query_age_seconds": 45.0,
        }
        connection = _FakeConnection(
            [_FakeResult([_ACTIVITY_ROW]), _FakeResult([blocker_row])]
        )
        engine = _FakeEngine(connection)
        mocker.patch.object(
            diagnostics, "_get_engine", new=AsyncMock(return_value=engine)
        )
        span = MagicMock()

        await diagnostics._sample_once(
            backend_pid=1234,
            span=span,
            phase="update_batch",
            attributes={"batch_ordinal": 3},
        )

        span.set_attributes.assert_called_once()
        snapshot = span.set_attributes.call_args.args[0]
        assert snapshot["db.sample.phase"] == "update_batch"
        assert snapshot["db.sample.backend_pid"] == 1234
        assert snapshot["db.sample.wait_event_type"] == "Lock"
        assert snapshot["db.sample.wait_event"] == "transactionid"
        assert snapshot["db.sample.query_age_seconds"] == 12.5
        assert snapshot["db.sample.blocking_pids"] == [4242]
        assert snapshot["db.sample.blocking_pids_count"] == 1
        assert snapshot["db.sample.batch_ordinal"] == 3
        assert snapshot["db.sample.blockers"][0]["pid"] == 4242

    async def test_no_sensitive_fields(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        connection = _FakeConnection([_FakeResult([_ACTIVITY_ROW]), _FakeResult([])])
        mocker.patch.object(
            diagnostics,
            "_get_engine",
            new=AsyncMock(return_value=_FakeEngine(connection)),
        )
        span = MagicMock()

        await diagnostics._sample_once(
            backend_pid=1234, span=span, phase="select_for_update", attributes={}
        )

        snapshot = span.set_attributes.call_args.args[0]
        for key in snapshot:
            lowered = key.lower()
            assert "sql" not in lowered
            assert "usename" not in lowered
            assert "client" not in lowered
            assert "password" not in lowered
            assert "addr" not in lowered
            # `query_age_seconds` is allowed; a bare raw-query field is not.
            assert not lowered.endswith(".query")

    async def test_no_activity_row_does_nothing(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        connection = _FakeConnection([_FakeResult([])])
        mocker.patch.object(
            diagnostics,
            "_get_engine",
            new=AsyncMock(return_value=_FakeEngine(connection)),
        )
        span = MagicMock()

        await diagnostics._sample_once(
            backend_pid=1234, span=span, phase="update_batch", attributes={}
        )

        span.set_attributes.assert_not_called()

    async def test_blockers_are_bounded(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_MAX_BLOCKERS", 2)
        diagnostics = PayoutQueryDiagnostics()
        activity_row = {**_ACTIVITY_ROW, "blocking_pids": [1, 2, 3, 4, 5]}
        connection = _FakeConnection([_FakeResult([activity_row]), _FakeResult([])])
        mocker.patch.object(
            diagnostics,
            "_get_engine",
            new=AsyncMock(return_value=_FakeEngine(connection)),
        )

        await diagnostics._sample_once(
            backend_pid=1234, span=MagicMock(), phase="update_batch", attributes={}
        )

        blocker_params = connection.executed_params[1]
        assert blocker_params == {"pids": [1, 2]}

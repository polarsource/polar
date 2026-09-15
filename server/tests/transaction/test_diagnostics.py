import asyncio
from collections.abc import Sequence
from types import SimpleNamespace
from typing import Any, Self
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
from sqlalchemy.pool import NullPool

from polar.config import settings
from polar.transaction.diagnostics import (
    PayoutQueryDiagnostics,
    resolve_driver_connection,
)


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


class _FakeDriver:
    def __init__(self) -> None:
        self.terminated = False

    def terminate(self) -> None:
        self.terminated = True

    def get_server_pid(self) -> int:
        return 999


class _FakeConnection:
    def __init__(self, results: Sequence[_FakeResult]) -> None:
        self._results = list(results)
        self.executed_params: list[Any] = []
        self.closed = False
        self.driver = _FakeDriver()
        # Mirror the SQLAlchemy AsyncConnection -> sync Connection -> DBAPI ->
        # driver connection chain that `_sample_once` walks to reach asyncpg.
        self.sync_connection = SimpleNamespace(
            connection=SimpleNamespace(driver_connection=self.driver)
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *args: object) -> bool:
        self.closed = True
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
    mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_MAX_CONCURRENCY", 4)


def _status_values(span: MagicMock) -> list[Any]:
    return [
        call.args[1]
        for call in span.set_attribute.call_args_list
        if call.args and call.args[0] == "db.sample.status"
    ]


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
        span = MagicMock()

        async with diagnostics.watch(backend_pid=1234, span=span, phase="update_batch"):
            pass

        sample.assert_not_called()
        assert _status_values(span) == ["disabled"]

    async def test_missing_backend_pid_is_noop(self, mocker: MockerFixture) -> None:
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        sample = mocker.patch.object(diagnostics, "_sample_when_slow")
        span = MagicMock()

        async with diagnostics.watch(backend_pid=None, span=span, phase="update_batch"):
            pass

        sample.assert_not_called()
        assert _status_values(span) == ["disabled"]

    async def test_fast_query_does_not_sample(self, mocker: MockerFixture) -> None:
        # A long delay means a query that completes quickly is cancelled while
        # the watchdog is still sleeping: no sampling connection is opened.
        _enable(mocker, delay=100.0)
        diagnostics = PayoutQueryDiagnostics()
        sample_once = mocker.patch.object(diagnostics, "_sample_once", new=AsyncMock())
        span = MagicMock()

        async with diagnostics.watch(backend_pid=1234, span=span, phase="update_batch"):
            await asyncio.sleep(0)

        sample_once.assert_not_awaited()
        # Armed then reported fast, so a missing snapshot is intelligible.
        assert _status_values(span) == ["armed", "fast"]

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
        span = MagicMock()

        async with diagnostics.watch(backend_pid=1234, span=span, phase="update_batch"):
            await asyncio.sleep(0.02)

        warn.assert_called()
        assert "error" in _status_values(span)

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
class TestTeardown:
    async def test_stuck_sampler_does_not_block_payout(
        self, mocker: MockerFixture
    ) -> None:
        # A sampler stuck in a slow/blocking connection close must never hold up
        # the payout: teardown cancels and detaches it off the critical path.
        _enable(mocker, delay=0.0)
        diagnostics = PayoutQueryDiagnostics()
        started = asyncio.Event()

        async def _hang(**kwargs: Any) -> None:
            started.set()
            await asyncio.sleep(3600)

        mocker.patch.object(diagnostics, "_sample_once", new=_hang)
        loop = asyncio.get_running_loop()

        start = loop.time()
        async with diagnostics.watch(
            backend_pid=1234, span=MagicMock(), phase="update_batch"
        ):
            await started.wait()
        elapsed = loop.time() - start

        assert elapsed < 1.0

        # The detached task is tracked, then cancelled and consumed promptly.
        for _ in range(100):
            if not diagnostics._pending_tasks:
                break
            await asyncio.sleep(0.01)
        assert diagnostics._pending_tasks == set()
        assert diagnostics._active_samples == 0

    async def test_capacity_full_skips_sampling(self, mocker: MockerFixture) -> None:
        _enable(mocker, delay=0.0)
        mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_MAX_CONCURRENCY", 1)
        diagnostics = PayoutQueryDiagnostics()
        diagnostics._active_samples = 1  # capacity already exhausted
        get_engine = mocker.patch.object(diagnostics, "_get_engine", new=AsyncMock())
        span = MagicMock()

        async with diagnostics.watch(backend_pid=1234, span=span, phase="update_batch"):
            await asyncio.sleep(0.02)

        # No sampling connection is opened when capacity is full.
        get_engine.assert_not_awaited()
        assert "skipped_busy" in _status_values(span)


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
            closed=asyncio.Event(),
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
        assert snapshot["db.sample.status"] == "completed"

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
            backend_pid=1234,
            span=span,
            phase="select_for_update",
            closed=asyncio.Event(),
            attributes={},
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

    async def test_no_activity_row_reports_not_found(
        self, mocker: MockerFixture
    ) -> None:
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
            backend_pid=1234,
            span=span,
            phase="update_batch",
            closed=asyncio.Event(),
            attributes={},
        )

        span.set_attributes.assert_not_called()
        assert _status_values(span) == ["not_found"]

    async def test_closed_span_is_not_written(self, mocker: MockerFixture) -> None:
        # If the payout finished (and closed its span) while the snapshot was
        # being gathered, the sampler must not write to the stale span.
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        connection = _FakeConnection([_FakeResult([_ACTIVITY_ROW]), _FakeResult([])])
        mocker.patch.object(
            diagnostics,
            "_get_engine",
            new=AsyncMock(return_value=_FakeEngine(connection)),
        )
        span = MagicMock()
        closed = asyncio.Event()
        closed.set()

        await diagnostics._sample_once(
            backend_pid=1234,
            span=span,
            phase="update_batch",
            closed=closed,
            attributes={},
        )

        span.set_attributes.assert_not_called()
        assert _status_values(span) == []

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
            backend_pid=1234,
            span=MagicMock(),
            phase="update_batch",
            closed=asyncio.Event(),
            attributes={},
        )

        blocker_params = connection.executed_params[1]
        assert blocker_params == {"pids": [1, 2]}

    async def test_terminates_connection_on_failure(
        self, mocker: MockerFixture
    ) -> None:
        # A failure mid-sample terminates the socket so the connection close can
        # never block: bounded, cancellation-safe teardown.
        _enable(mocker)
        diagnostics = PayoutQueryDiagnostics()
        connection = _FakeConnection([])
        mocker.patch.object(
            connection,
            "execute",
            new=AsyncMock(side_effect=RuntimeError("sampling blew up")),
        )
        mocker.patch.object(
            diagnostics,
            "_get_engine",
            new=AsyncMock(return_value=_FakeEngine(connection)),
        )

        with pytest.raises(RuntimeError, match="sampling blew up"):
            await diagnostics._sample_once(
                backend_pid=1234,
                span=MagicMock(),
                phase="update_batch",
                closed=asyncio.Event(),
                attributes={},
            )

        assert connection.driver.terminated is True
        assert connection.closed is True


def _driver_pid(connection: AsyncConnection) -> int:
    driver_connection = resolve_driver_connection(connection)
    assert driver_connection is not None
    return int(driver_connection.get_server_pid())


@pytest.mark.asyncio
class TestLiveDiagnosticsIntegration:
    """Exercise the real activity + blocker SQL against Postgres via asyncpg."""

    async def test_captures_real_lock_wait_and_blockers(
        self, mocker: MockerFixture
    ) -> None:
        _enable(mocker, delay=0.2)
        mocker.patch.object(settings, "PAYOUT_QUERY_DIAGNOSTICS_MAX_CONCURRENCY", 1)
        diagnostics = PayoutQueryDiagnostics()
        engine = create_async_engine(
            settings.get_postgres_dsn("asyncpg"), poolclass=NullPool
        )
        span = MagicMock()
        blocker: AsyncConnection | None = None
        payout: AsyncConnection | None = None
        try:
            async with engine.begin() as setup:
                await setup.execute(text("DROP TABLE IF EXISTS _diag_lock_test"))
                await setup.execute(
                    text("CREATE TABLE _diag_lock_test (id int primary key)")
                )
                await setup.execute(text("INSERT INTO _diag_lock_test VALUES (1)"))

            blocker = await engine.connect()
            await blocker.begin()
            await blocker.execute(
                text("SELECT id FROM _diag_lock_test WHERE id = 1 FOR UPDATE")
            )
            blocker_pid = _driver_pid(blocker)

            payout = await engine.connect()
            await payout.begin()
            payout_pid = _driver_pid(payout)
            assert payout_pid != blocker_pid

            async with diagnostics.watch(
                backend_pid=payout_pid, span=span, phase="update_batch"
            ):
                blocked = asyncio.create_task(
                    payout.execute(
                        text("SELECT id FROM _diag_lock_test WHERE id = 1 FOR UPDATE")
                    )
                )
                for _ in range(250):
                    if span.set_attributes.called:
                        break
                    await asyncio.sleep(0.02)
                await blocker.rollback()  # release the lock
                await asyncio.wait_for(blocked, timeout=10)

            snapshot = span.set_attributes.call_args.args[0]
            assert snapshot["db.sample.status"] == "completed"
            assert snapshot["db.sample.backend_pid"] == payout_pid
            assert snapshot["db.sample.wait_event_type"] == "Lock"
            assert blocker_pid in snapshot["db.sample.blocking_pids"]
            assert any(b["pid"] == blocker_pid for b in snapshot["db.sample.blockers"])
        finally:
            if payout is not None:
                await payout.rollback()
                await payout.close()
            if blocker is not None:
                await blocker.close()
            async with engine.begin() as teardown:
                await teardown.execute(text("DROP TABLE IF EXISTS _diag_lock_test"))
            await engine.dispose()
            if diagnostics._engine is not None:
                await diagnostics._engine.dispose()

    async def test_server_statement_timeout_fires_before_client(
        self, mocker: MockerFixture
    ) -> None:
        # The server statement_timeout must cancel first (clean 57014), before
        # the asyncpg client's command_timeout has to tear the connection down.
        _enable(mocker)
        mocker.patch.object(
            settings, "PAYOUT_QUERY_DIAGNOSTICS_STATEMENT_TIMEOUT_SECONDS", 0.5
        )
        mocker.patch.object(
            settings, "PAYOUT_QUERY_DIAGNOSTICS_COMMAND_TIMEOUT_MARGIN_SECONDS", 2.0
        )
        diagnostics = PayoutQueryDiagnostics()
        engine = diagnostics._create_engine()
        try:
            with pytest.raises(DBAPIError) as excinfo:
                async with engine.connect() as connection:
                    await connection.execute(text("SELECT pg_sleep(5)"))
            # 57014 = query_canceled, i.e. the server statement_timeout, not a
            # client-side command_timeout (which surfaces as a TimeoutError).
            assert getattr(excinfo.value.orig, "sqlstate", None) == "57014"
        finally:
            await engine.dispose()

    async def test_diagnostic_failure_leaves_payout_result_intact(
        self, mocker: MockerFixture
    ) -> None:
        # A diagnostic connection failure (here, connection refused — the same
        # swallow path a permissions error takes) must not touch the payout.
        _enable(mocker, delay=0.0)
        diagnostics = PayoutQueryDiagnostics()
        unreachable = create_async_engine(
            "postgresql+asyncpg://polar:polar@127.0.0.1:9/polar_test",
            poolclass=NullPool,
            connect_args={"timeout": 1.0},
        )
        mocker.patch.object(
            diagnostics, "_get_engine", new=AsyncMock(return_value=unreachable)
        )
        payout_engine = create_async_engine(
            settings.get_postgres_dsn("asyncpg"), poolclass=NullPool
        )
        span = MagicMock()
        try:
            async with payout_engine.connect() as connection:
                payout_pid = _driver_pid(connection)
                async with diagnostics.watch(
                    backend_pid=payout_pid, span=span, phase="update_batch"
                ):
                    result = await connection.execute(
                        text("SELECT pg_sleep(0.4), 42 AS value")
                    )
                    row = result.first()

            assert row is not None
            assert row.value == 42  # payout query unaffected by diagnostic failure

            for _ in range(100):
                if "error" in _status_values(span):
                    break
                await asyncio.sleep(0.02)
            assert "error" in _status_values(span)
        finally:
            await unreachable.dispose()
            await payout_engine.dispose()

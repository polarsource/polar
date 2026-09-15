"""Best-effort, opt-in live diagnostics for slow payout row-lock/UPDATE queries.

The payout row-lock selection and the batched ``UPDATE transactions SET
payout_transaction_id`` can stall for tens of seconds under lock contention.
When they do, the payout session's own connection is busy awaiting the query,
so the running state (wait events, blockers) can only be observed from a
*different* connection.

This module opens a SEPARATE, short-lived connection to the primary database
and reads an allowlisted, non-sensitive snapshot from ``pg_stat_activity`` for
the payout's backend PID: liveness ``state``, ``wait_event_type`` /
``wait_event``, query/transaction age and ``pg_blocking_pids``, plus bounded
metadata about the blocking backends.

Safety properties (see the hard requirements in the PR notes):

- Instrumentation only — never mutates, never touches the payout session, never
  runs concurrent operations on it.
- Gated by ``PAYOUT_QUERY_DIAGNOSTICS_ENABLED`` (default off). Lightweight spans
  are emitted by the caller unconditionally; this is the heavy, opt-in part.
- Bounded and cancel-safe: a single snapshot per phase, only after a delay (so
  fast queries never open a sampling connection), on a dedicated ``NullPool``
  engine with small connect/statement timeouts. Live sampling is capped per
  process so a burst of slow payouts can't open one connection each. On teardown
  the sampler is cancelled and detached from the payout critical path; its
  connection is terminated (socket dropped) so cleanup can never block, and it
  never writes to the span once the payout has moved on.
- Isolated failure: any exception is swallowed and logged. Because sampling runs
  on its own connection, it can neither abort the payout transaction nor mask
  the original query error.

The ``db.sample.status`` attribute makes a missing snapshot intelligible. Its
allowlisted values are: ``disabled`` (flag off or no backend PID), ``armed``
(sampler scheduled), ``fast`` (query finished before the delay), ``skipped_busy``
(per-process capacity reached), ``completed`` (snapshot attached), ``not_found``
(backend already gone from ``pg_stat_activity``), ``error`` (sampling failed).
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator, Mapping
from typing import Any

import logfire
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()

# Allowlisted, non-sensitive columns only. Never selects `query` (raw SQL and
# parameters), connection strings, user/role names or client addresses.
_ACTIVITY_SAMPLE_SQL = text(
    """
    SELECT
        state,
        wait_event_type,
        wait_event,
        backend_type,
        EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) AS query_age_seconds,
        EXTRACT(EPOCH FROM (clock_timestamp() - xact_start)) AS xact_age_seconds,
        pg_blocking_pids(pid) AS blocking_pids
    FROM pg_stat_activity
    WHERE pid = :pid
    """
)

_BLOCKER_SAMPLE_SQL = text(
    """
    SELECT
        pid,
        state,
        wait_event_type,
        wait_event,
        backend_type,
        EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) AS query_age_seconds
    FROM pg_stat_activity
    WHERE pid = ANY(:pids)
    """
)

_STATUS_ATTRIBUTE = "db.sample.status"


class PayoutQueryDiagnostics:
    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._engine_lock = asyncio.Lock()
        # Detached teardown tasks, kept referenced until done so they are never
        # garbage-collected mid-flight and their exceptions are always consumed.
        self._pending_tasks: set[asyncio.Task[None]] = set()
        # Live sampling connections currently open. Mutated only from the event
        # loop thread, so plain int arithmetic is race-free here.
        self._active_samples = 0

    @property
    def enabled(self) -> bool:
        return settings.PAYOUT_QUERY_DIAGNOSTICS_ENABLED

    async def _get_engine(self) -> AsyncEngine:
        if self._engine is None:
            async with self._engine_lock:
                if self._engine is None:
                    self._engine = self._create_engine()
        return self._engine

    def _create_engine(self) -> AsyncEngine:
        statement_timeout_seconds = (
            settings.PAYOUT_QUERY_DIAGNOSTICS_STATEMENT_TIMEOUT_SECONDS
        )
        statement_timeout_ms = int(statement_timeout_seconds * 1000)
        # Give the asyncpg client enough margin over the server statement_timeout
        # that the server always cancels first (a clean 57014), instead of the
        # client timing out and having to tear the connection down.
        command_timeout_seconds = (
            statement_timeout_seconds
            + settings.PAYOUT_QUERY_DIAGNOSTICS_COMMAND_TIMEOUT_MARGIN_SECONDS
        )
        connect_args: dict[str, Any] = {
            "prepared_statement_cache_size": 0,
            "timeout": settings.PAYOUT_QUERY_DIAGNOSTICS_CONNECT_TIMEOUT_SECONDS,
            "command_timeout": command_timeout_seconds,
            "server_settings": {
                "application_name": f"{settings.ENV.value}.payout-diagnostics",
                "statement_timeout": str(statement_timeout_ms),
            },
        }
        if settings.POSTGRES_SSL:
            connect_args["ssl"] = "require"
        # NullPool: each sample opens and fully closes its own connection, so
        # diagnostics never retains an idle/open transaction and never competes
        # with the payout worker for the main pool.
        return create_async_engine(
            settings.get_postgres_dsn("asyncpg"),
            poolclass=NullPool,
            connect_args=connect_args,
        )

    @contextlib.asynccontextmanager
    async def watch(
        self,
        *,
        backend_pid: int | None,
        span: logfire.LogfireSpan,
        phase: str,
        **attributes: Any,
    ) -> AsyncIterator[None]:
        """Sample Postgres state if the wrapped query runs longer than the delay.

        Wrap the query under a Logfire span; on a slow query, the wait/blocking
        snapshot is attached to ``span`` from a separate connection. On a fast
        query, no sampling connection is ever opened.
        """
        if not self.enabled or backend_pid is None:
            span.set_attribute(_STATUS_ATTRIBUTE, "disabled")
            yield
            return

        # ``closed`` fences the sampler off the span the moment the payout moves
        # on; ``sampling_started`` records whether the delay elapsed so teardown
        # can distinguish a fast query from one that was actually sampled.
        closed = asyncio.Event()
        sampling_started = asyncio.Event()
        span.set_attribute(_STATUS_ATTRIBUTE, "armed")

        task = asyncio.create_task(
            self._sample_when_slow(
                backend_pid=backend_pid,
                span=span,
                phase=phase,
                closed=closed,
                sampling_started=sampling_started,
                attributes=attributes,
            )
        )
        try:
            yield
        finally:
            # Fence first, then cancel: no span writes after this point.
            closed.set()
            task.cancel()
            if not sampling_started.is_set():
                span.set_attribute(_STATUS_ATTRIBUTE, "fast")
            # Detach teardown from the payout critical path. Cancelling a sampler
            # mid-query means asyncpg has to tear its connection down, which can
            # block; we must never await that here. The task is tracked and its
            # result consumed by the done callback.
            self._detach(task, phase=phase)

    def _detach(self, task: "asyncio.Task[None]", *, phase: str) -> None:
        self._pending_tasks.add(task)

        def _consume(finished: "asyncio.Task[None]") -> None:
            self._pending_tasks.discard(finished)
            if finished.cancelled():
                return
            exception = finished.exception()
            if exception is not None:
                log.warning(
                    "payout.diagnostics.teardown_failed",
                    phase=phase,
                    error=str(exception),
                )

        task.add_done_callback(_consume)

    async def _sample_when_slow(
        self,
        *,
        backend_pid: int,
        span: logfire.LogfireSpan,
        phase: str,
        closed: asyncio.Event,
        sampling_started: asyncio.Event,
        attributes: Mapping[str, Any],
    ) -> None:
        try:
            await asyncio.sleep(settings.PAYOUT_QUERY_DIAGNOSTICS_DELAY_SECONDS)
        except asyncio.CancelledError:
            # Query finished before the delay elapsed: no sampling, no polling.
            # ``watch`` records the "fast" status.
            return

        sampling_started.set()

        if self._active_samples >= settings.PAYOUT_QUERY_DIAGNOSTICS_MAX_CONCURRENCY:
            self._set_status(span, closed, "skipped_busy")
            return

        self._active_samples += 1
        try:
            await self._sample_once(
                backend_pid=backend_pid,
                span=span,
                phase=phase,
                closed=closed,
                attributes=attributes,
            )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self._set_status(span, closed, "error")
            log.warning("payout.diagnostics.sample_failed", phase=phase, error=str(e))
        finally:
            self._active_samples -= 1

    async def _sample_once(
        self,
        *,
        backend_pid: int,
        span: logfire.LogfireSpan,
        phase: str,
        closed: asyncio.Event,
        attributes: Mapping[str, Any],
    ) -> None:
        engine = await self._get_engine()
        async with engine.connect() as connection:
            driver_connection = resolve_driver_connection(connection)
            try:
                result = await connection.execute(
                    _ACTIVITY_SAMPLE_SQL, {"pid": backend_pid}
                )
                row = result.mappings().first()
                if row is None:
                    self._set_status(span, closed, "not_found")
                    return

                blocking_pids = [int(pid) for pid in (row["blocking_pids"] or [])]
                snapshot: dict[str, Any] = {
                    "db.sample.phase": phase,
                    "db.sample.backend_pid": backend_pid,
                    "db.sample.state": row["state"],
                    "db.sample.wait_event_type": row["wait_event_type"],
                    "db.sample.wait_event": row["wait_event"],
                    "db.sample.backend_type": row["backend_type"],
                    "db.sample.query_age_seconds": _as_float(row["query_age_seconds"]),
                    "db.sample.xact_age_seconds": _as_float(row["xact_age_seconds"]),
                    "db.sample.blocking_pids": blocking_pids,
                    "db.sample.blocking_pids_count": len(blocking_pids),
                }
                for key, value in attributes.items():
                    snapshot[f"db.sample.{key}"] = value

                if blocking_pids:
                    snapshot["db.sample.blockers"] = await self._sample_blockers(
                        connection, blocking_pids
                    )

                # The payout may have finished (and closed the span) while we were
                # sampling. Never write to a span that has moved on.
                if closed.is_set():
                    return

                snapshot[_STATUS_ATTRIBUTE] = "completed"
                span.set_attributes(snapshot)
                logfire.warn(
                    "payout query stalled: {phase}",
                    phase=phase,
                    **snapshot,
                )
            except BaseException:
                # Drop the socket immediately so the connection close below (in
                # the async-with exit) can never block on the server — the whole
                # teardown stays bounded even under cancellation.
                if driver_connection is not None:
                    driver_connection.terminate()
                raise

    async def _sample_blockers(
        self, connection: AsyncConnection, blocking_pids: list[int]
    ) -> list[dict[str, Any]]:
        bounded = blocking_pids[: settings.PAYOUT_QUERY_DIAGNOSTICS_MAX_BLOCKERS]
        result = await connection.execute(_BLOCKER_SAMPLE_SQL, {"pids": bounded})
        return [
            {
                "pid": int(row["pid"]),
                "state": row["state"],
                "wait_event_type": row["wait_event_type"],
                "wait_event": row["wait_event"],
                "backend_type": row["backend_type"],
                "query_age_seconds": _as_float(row["query_age_seconds"]),
            }
            for row in result.mappings()
        ]

    def _set_status(
        self, span: logfire.LogfireSpan, closed: asyncio.Event, status: str
    ) -> None:
        if closed.is_set():
            return
        span.set_attribute(_STATUS_ATTRIBUTE, status)


def resolve_driver_connection(connection: AsyncConnection) -> Any:
    """Underlying asyncpg connection behind a SQLAlchemy AsyncConnection.

    Used to read the cached backend PID and to ``terminate()`` the socket
    without a server round-trip. Returns ``None`` if the chain isn't available.
    """
    sync_connection = connection.sync_connection
    if sync_connection is None:
        return None
    return sync_connection.connection.driver_connection


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


payout_query_diagnostics = PayoutQueryDiagnostics()

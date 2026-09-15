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
  engine with small connect/statement timeouts so it can neither exhaust the
  pool nor hang, and always cleaned up.
- Isolated failure: any exception is swallowed and logged. Because sampling runs
  on its own connection, it can neither abort the payout transaction nor mask
  the original query error.
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator, Mapping
from typing import Any

import logfire
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
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


class PayoutQueryDiagnostics:
    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._engine_lock = asyncio.Lock()

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
        statement_timeout_ms = int(
            settings.PAYOUT_QUERY_DIAGNOSTICS_STATEMENT_TIMEOUT_SECONDS * 1000
        )
        connect_args: dict[str, Any] = {
            "prepared_statement_cache_size": 0,
            "timeout": settings.PAYOUT_QUERY_DIAGNOSTICS_CONNECT_TIMEOUT_SECONDS,
            "command_timeout": settings.PAYOUT_QUERY_DIAGNOSTICS_STATEMENT_TIMEOUT_SECONDS,
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

    async def dispose(self) -> None:
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None

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
            yield
            return

        task = asyncio.create_task(
            self._sample_when_slow(
                backend_pid=backend_pid, span=span, phase=phase, attributes=attributes
            )
        )
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                log.warning(
                    "payout.diagnostics.cleanup_failed", phase=phase, error=str(e)
                )

    async def _sample_when_slow(
        self,
        *,
        backend_pid: int,
        span: logfire.LogfireSpan,
        phase: str,
        attributes: Mapping[str, Any],
    ) -> None:
        try:
            await asyncio.sleep(settings.PAYOUT_QUERY_DIAGNOSTICS_DELAY_SECONDS)
        except asyncio.CancelledError:
            # Query finished before the delay elapsed: no sampling, no polling.
            return

        try:
            await self._sample_once(
                backend_pid=backend_pid, span=span, phase=phase, attributes=attributes
            )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("payout.diagnostics.sample_failed", phase=phase, error=str(e))

    async def _sample_once(
        self,
        *,
        backend_pid: int,
        span: logfire.LogfireSpan,
        phase: str,
        attributes: Mapping[str, Any],
    ) -> None:
        engine = await self._get_engine()
        async with engine.connect() as connection:
            result = await connection.execute(
                _ACTIVITY_SAMPLE_SQL, {"pid": backend_pid}
            )
            row = result.mappings().first()
            if row is None:
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

            span.set_attributes(snapshot)
            logfire.warn(
                "payout query stalled: {phase}",
                phase=phase,
                **snapshot,
            )

    async def _sample_blockers(
        self, connection: Any, blocking_pids: list[int]
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


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


payout_query_diagnostics = PayoutQueryDiagnostics()

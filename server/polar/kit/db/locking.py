import uuid
from collections.abc import Sequence

from sqlalchemy import ARRAY, Text, bindparam, func, select
from sqlalchemy.exc import DBAPIError

from polar.kit.db.postgres import AsyncReadSession, AsyncSession


async def pg_advisory_xact_lock(
    session: AsyncSession | AsyncReadSession, namespace: str, key: str | uuid.UUID
) -> None:
    """
    Acquire a transaction-level exclusive advisory lock.

    The lock is derived from a stable hash of ``namespace`` and ``key`` and is
    released automatically when the transaction ends. Unlike ``FOR UPDATE``, it
    doesn't require the target rows to exist, so concurrent transactions
    serialize even when there are no rows yet to lock.
    """
    lock_key = func.hashtextextended(f"{namespace}:{key}", 0)
    await session.execute(select(func.pg_advisory_xact_lock(lock_key)))


async def pg_advisory_xact_locks(
    session: AsyncSession | AsyncReadSession,
    namespace: str,
    keys: Sequence[str | uuid.UUID],
) -> None:
    """
    Acquire the same locks as ``pg_advisory_xact_lock`` for each key, in one round
    trip and in the order of ``keys``.
    """
    if not keys:
        return
    lock_key = func.unnest(
        bindparam(
            "lock_keys", [f"{namespace}:{key}" for key in keys], type_=ARRAY(Text)
        )
    ).column_valued("lock_key")
    await session.execute(
        select(func.pg_advisory_xact_lock(func.hashtextextended(lock_key, 0)))
    )


def is_lock_not_available_error(e: DBAPIError) -> bool:
    """
    Check if the error is a PostgreSQL lock_not_available error.

    PostgreSQL SQLSTATE 55P03 indicates the lock could not be acquired
    (typically from FOR UPDATE NOWAIT).

    Args:
        e: SQLAlchemy DBAPIError wrapping the underlying database error

    Returns:
        True if this is a lock_not_available error, False otherwise
    """
    # Check via asyncpg's exception chain
    orig = getattr(e, "orig", None)
    if orig is None:
        return False

    # asyncpg stores the actual exception in __cause__
    cause = getattr(orig, "__cause__", None)
    if cause is not None and hasattr(cause, "sqlstate"):
        return cause.sqlstate == "55P03"

    # Fallback to string matching for compatibility with other drivers
    return "could not obtain lock" in str(e)

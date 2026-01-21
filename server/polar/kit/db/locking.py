from sqlalchemy.exc import DBAPIError


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

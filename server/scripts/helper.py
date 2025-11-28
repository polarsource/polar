import asyncio
import logging.config
from functools import wraps
from typing import Any, cast

import structlog
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from sqlalchemy import CursorResult, Update, bindparam
from sqlalchemy.sql.elements import BindParameter

from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def configure_script_logging() -> None:
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def limit_bindparam() -> BindParameter[int]:
    """
    Create a bindparam for the batch limit in update statements.

    Use this in your subquery's `.limit()` clause:

        subquery = (
            select(MyModel.id)
            .where(MyModel.some_column.is_(None))
            .order_by(MyModel.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )
    """
    return bindparam("limit")


async def run_batched_update(
    update_statement: Update,
    *,
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
) -> int:
    """
    Execute a batched update migration to avoid long locks on large tables.

    The update statement should be constructed such that it only updates rows
    that need updating. The function will keep executing the statement until
    no more rows are affected.

    The statement must use `limit_bindparam()` in the subquery's LIMIT clause:

        subquery = (
            select(MyModel.id)
            .where(MyModel.some_column.is_(None))
            .order_by(MyModel.id)
            .limit(limit_bindparam())
            .scalar_subquery()
        )

        update_statement = (
            update(MyModel)
            .values(some_column="value")
            .where(MyModel.id.in_(subquery))
        )

        await run_batched_update(update_statement, batch_size=5000)

    Args:
        update_statement: A SQLAlchemy Update statement with a `:limit` bindparam
            in the subquery. The statement should be designed to update only a
            subset of rows.
        batch_size: Number of rows to process per batch.
        sleep_seconds: Seconds to sleep between batches to reduce database load.

    Returns:
        Total number of rows updated.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_updated = 0
    batch_number = 0

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows updated", total=None)

            while True:
                async with sessionmaker() as session:
                    result = await session.execute(
                        update_statement, {"limit": batch_size}
                    )
                    await session.commit()

                    # https://github.com/sqlalchemy/sqlalchemy/commit/67f62aac5b49b6d048ca39019e5bd123d3c9cfb2
                    rows_updated = cast(CursorResult[Any], result).rowcount

                    if rows_updated == 0:
                        progress.update(
                            task,
                            description=f"[green]✓ Complete: {total_updated} rows updated",
                        )
                        break

                    batch_number += 1
                    total_updated += rows_updated
                    progress.update(
                        task,
                        description=(
                            f"[cyan]Batch {batch_number}: {total_updated} rows updated"
                        ),
                    )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

        return total_updated

    finally:
        await engine.dispose()

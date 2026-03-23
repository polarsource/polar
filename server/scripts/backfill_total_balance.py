import asyncio
import uuid
from functools import wraps
from pathlib import Path

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from sqlalchemy import select, text

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging

cli = typer.Typer()

configure_script_logging()

CURSOR_FILE = Path("backfill_total_balance.cursor")


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(500, help="Number of orgs to fetch per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between orgs"),
    reset: bool = typer.Option(False, help="Reset cursor and start from the beginning"),
) -> None:
    """Backfill total_balance for all organizations, one at a time.

    Resumable: stores a cursor file (backfill_total_balance.cursor) with
    the last processed org ID. Re-run to pick up where you left off.
    Use --reset to start from the beginning.

    Usage:
        uv run python -m scripts.backfill_total_balance backfill
        uv run python -m scripts.backfill_total_balance backfill --batch-size 100
        uv run python -m scripts.backfill_total_balance backfill --reset
    """
    if reset and CURSOR_FILE.exists():
        CURSOR_FILE.unlink()
        print("Cursor reset.")

    # Load cursor
    last_id: uuid.UUID | None = None
    if CURSOR_FILE.exists():
        last_id = uuid.UUID(CURSOR_FILE.read_text().strip())
        print(f"Resuming from cursor: {last_id}")

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_updated = 0

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]0 orgs updated", total=None)

            while True:
                async with sessionmaker() as session:
                    # Fetch next batch of (id, account_id) pairs
                    id_query = (
                        select(Organization.id, Organization.account_id)
                        .where(Organization.deleted_at.is_(None))
                        .order_by(Organization.id)
                        .limit(batch_size)
                    )
                    if last_id is not None:
                        id_query = id_query.where(Organization.id > last_id)

                    id_result = await session.execute(id_query)
                    orgs = id_result.all()

                    if not orgs:
                        progress.update(
                            task,
                            description=f"[green]✓ Complete: {total_updated} orgs updated",
                        )
                        break

                    # Process each org independently
                    for org_id, account_id in orgs:
                        if account_id is not None:
                            sum_result = await session.execute(
                                text("""
                                    SELECT COALESCE(SUM(amount), 0)
                                    FROM transactions
                                    WHERE account_id = :account_id
                                      AND type = 'balance'
                                """),
                                {"account_id": account_id},
                            )
                            balance = sum_result.scalar_one()
                        else:
                            balance = 0

                        await session.execute(
                            text("""
                                UPDATE organizations
                                SET total_balance = :balance
                                WHERE id = :org_id
                            """),
                            {"balance": balance, "org_id": org_id},
                        )

                        last_id = org_id
                        total_updated += 1

                    await session.commit()

                    # Save cursor after each batch
                    CURSOR_FILE.write_text(str(last_id))

                    progress.update(
                        task,
                        description=f"[cyan]{total_updated} orgs updated",
                    )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

        # Clean up cursor on successful completion
        if CURSOR_FILE.exists():
            CURSOR_FILE.unlink()

        print(f"\nBackfilled {total_updated} organizations.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

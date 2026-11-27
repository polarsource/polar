"""
Grant `catalog:publish` to dashboard sessions created before the scope existed.

Dashboard sessions store the scopes they were created with, and publishing a
catalog now requires `catalog:publish`. Sessions that can write products get it,
so dashboard publishing keeps working without signing in again. Read-only
sessions (backoffice impersonation) and expired ones are left alone.

Run it right after the deploy that introduces the scope.

Usage:
    cd server

    # Dry-run (default) — count the sessions to update:
    uv run python -m scripts.backfill_user_session_catalog_publish_scope

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_user_session_catalog_publish_scope --execute
"""

import typer
from rich.console import Console
from sqlalchemy import ColumnElement, Select, Update, and_, func, not_, select, update

from polar.auth.scope import Scope
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import UserSession
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()

configure_script_console_logging()


def _missing_scope() -> ColumnElement[bool]:
    return and_(
        UserSession.expires_at > utc_now(),
        UserSession.scopes.contains([Scope.products_write]),
        not_(UserSession.scopes.contains([Scope.catalog_publish])),
    )


def count_statement() -> Select[int]:
    return select(func.count()).select_from(UserSession).where(_missing_scope())


def backfill_statement() -> Update:
    subquery = (
        select(UserSession.id)
        .where(_missing_scope())
        .order_by(UserSession.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(UserSession)
        .where(UserSession.id.in_(subquery))
        .values(scopes=func.array_append(UserSession.scopes, Scope.catalog_publish))
    )


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            total = (await session.execute(count_statement())).scalar_one()
        console.print(f"[bold]{total}[/bold] session(s) to update.")
        if total == 0 or not execute:
            if total:
                console.print("[yellow]Dry-run — use --execute to update them.")
            return

        updated = await run_batched_update(
            backfill_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
        )
        console.print(f"[green]Updated {updated} session(s).")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

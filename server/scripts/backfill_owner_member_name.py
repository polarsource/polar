"""
Copy `customers.name` onto the owner member of individual customers.

`CustomerService.update` used to mirror only the email to the owner member, so
renaming a customer left the old name on the member, and the customer portal
kept showing it. The update path now mirrors both fields; this closes the gap
for members that drifted before that change.

Customers without a name are skipped, so a member's name is never cleared.

Usage:
    cd server

    # Dry-run (default) — report how many members would change:
    uv run python -m scripts.backfill_owner_member_name

    # Execute the backfill (batched):
    uv run python -m scripts.backfill_owner_member_name --execute
"""

import asyncio
from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import select, update

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Customer, Member
from polar.models.customer import CustomerType
from polar.models.member import MemberRole
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


async def _fetch_batch(
    session: AsyncSession, *, after: UUID | None, batch_size: int
) -> list[tuple[UUID, str | None]]:
    statement = (
        select(Member.id, Customer.name)
        .join(Customer, Customer.id == Member.customer_id)
        .where(
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
            Customer.deleted_at.is_(None),
            Customer.type == CustomerType.individual,
            Customer.name.is_not(None),
            Member.name.is_distinct_from(Customer.name),
        )
        .order_by(Member.id)
        .limit(batch_size)
    )
    if after is not None:
        statement = statement.where(Member.id > after)
    result = await session.execute(statement)
    return [(member_id, name) for member_id, name in result.all()]


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        1000, min=1, help="Number of members to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        after: UUID | None = None
        changed = 0

        while True:
            async with sessionmaker() as session:
                batch = await _fetch_batch(session, after=after, batch_size=batch_size)
                if not batch:
                    break

                after = batch[-1][0]
                changed += len(batch)

                if execute:
                    await session.execute(
                        update(Member),
                        [{"id": member_id, "name": name} for member_id, name in batch],
                    )
                    await session.commit()

            console.print(
                f"{changed} member(s) {'updated' if execute else 'to update'}."
            )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

        if changed == 0:
            console.print("[green]Every owner member name is already in sync.")
        elif execute:
            log.info("backfill.complete", rowcount=changed)
            console.print(f"[green]Synced {changed} owner member name(s).")
        else:
            console.print(
                f"[yellow]Dry-run — {changed} member(s) would change. "
                "Use --execute to apply."
            )

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

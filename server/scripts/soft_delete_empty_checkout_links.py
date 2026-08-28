"""
Soft delete checkout links that have no product.

A checkout link with no product cannot create a checkout session, and reading
one fails response validation, so the merchant's whole checkout links page
returns 500. Soft deleting is what archiving a link's last product does, and it
restores the page.

The lock in `CheckoutLinkRepository.archive_product` keeps new ones from
appearing, so this is a one-shot repair.

Usage:
    cd server

    # Dry-run (default) — count the affected links:
    uv run python -m scripts.soft_delete_empty_checkout_links

    # Execute the repair (batched):
    uv run python -m scripts.soft_delete_empty_checkout_links --execute
"""

import structlog
import typer
from rich.console import Console
from sqlalchemy import Select, Update, and_, func, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import CheckoutLink, CheckoutLinkProduct
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

_has_no_product = and_(
    CheckoutLink.deleted_at.is_(None),
    ~select(1).where(CheckoutLinkProduct.checkout_link_id == CheckoutLink.id).exists(),
)


def empty_count_statement() -> Select[tuple[int]]:
    return select(func.count()).select_from(CheckoutLink).where(_has_no_product)


def soft_delete_statement() -> Update:
    subquery = (
        select(CheckoutLink.id)
        .where(_has_no_product)
        .order_by(CheckoutLink.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )
    return (
        update(CheckoutLink)
        .where(CheckoutLink.id.in_(subquery))
        .values(deleted_at=func.now())
    )


@cli.command()
@typer_async
async def soft_delete_empty_checkout_links(
    execute: bool = typer.Option(
        False, help="Actually run the repair (default: dry-run)"
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
            result = await session.execute(empty_count_statement())
            total = result.scalar_one()

        console.print(f"[bold]{total}[/bold] checkout link(s) with no product.")

        if total == 0:
            console.print("[green]Every live checkout link has a product.")
            return

        if not execute:
            console.print("[yellow]Dry-run — use --execute to soft delete them.")
            return

        console.rule("[bold]Executing repair")
        rows_updated = await run_batched_update(
            soft_delete_statement(),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
        log.info("soft_delete_empty_checkout_links.complete", rowcount=rows_updated)
        console.print(f"[green]Soft deleted {rows_updated} checkout link(s).")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

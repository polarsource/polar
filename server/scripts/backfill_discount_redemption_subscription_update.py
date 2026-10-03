"""
Link existing discount redemptions to the pending subscription update they belong to.

A scheduled (`next_period`) product change with a discount redeems the discount
right away, but the discount only reaches the subscription when the update is
applied at the next cycle. Clearing or replacing the pending update releases
that redemption through `discount_redemptions.subscription_update_id`.

Redemptions written before that column existed have no link, so clearing their
pending update would still leak them. For every unapplied, non-deleted update
carrying a discount, this links the most recent unlinked, checkout-less
redemption of that discount on the same subscription.

Usage:
    cd server

    # Dry-run (default) — report how many redemptions would be linked:
    uv run python -m scripts.backfill_discount_redemption_subscription_update

    # Execute the backfill:
    uv run python -m scripts.backfill_discount_redemption_subscription_update --execute
"""

from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import select, update
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import DiscountRedemption, SubscriptionUpdate
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()


async def get_links(session: AsyncSession) -> list[tuple[UUID, UUID]]:
    """Return `(discount_redemption_id, subscription_update_id)` pairs to link."""
    linked_redemption = aliased(DiscountRedemption)
    statement = (
        select(DiscountRedemption.id, SubscriptionUpdate.id)
        .join(
            SubscriptionUpdate,
            (SubscriptionUpdate.subscription_id == DiscountRedemption.subscription_id)
            & (SubscriptionUpdate.discount_id == DiscountRedemption.discount_id),
        )
        .where(
            SubscriptionUpdate.applied_at.is_(None),
            SubscriptionUpdate.deleted_at.is_(None),
            DiscountRedemption.checkout_id.is_(None),
            DiscountRedemption.subscription_update_id.is_(None),
            ~select(linked_redemption.id)
            .where(linked_redemption.subscription_update_id == SubscriptionUpdate.id)
            .exists(),
        )
        .distinct(SubscriptionUpdate.id)
        .order_by(SubscriptionUpdate.id, DiscountRedemption.created_at.desc())
    )
    result = await session.execute(statement)
    return list(result.tuples().all())


async def link(session: AsyncSession, links: list[tuple[UUID, UUID]]) -> None:
    await session.execute(
        update(DiscountRedemption),
        [
            {"id": redemption_id, "subscription_update_id": subscription_update_id}
            for redemption_id, subscription_update_id in links
        ],
    )


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            links = await get_links(session)
            if not links:
                console.print("[green]No pending update has an unlinked redemption.")
                return

            if not execute:
                console.print(
                    f"[yellow]Dry-run — {len(links)} redemption(s) would be linked. "
                    "Use --execute to apply."
                )
                return

            await link(session, links)
            await session.commit()
            log.info("backfill.complete", rowcount=len(links))
            console.print(f"[green]Linked {len(links)} redemption(s).")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

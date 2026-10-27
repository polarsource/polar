"""Waive historical usage skipped by the inactive-price check from PR #9057.

Only pending sum/count entries on active subscriptions are soft deleted, and only
when their price is no longer attached and usage predates current_period_start.
Current-period usage stays billable. This intentionally waives the old charges.

The creation cutoff and each subscription's period boundary are captured before
writing, so renewals cannot expand the cleanup while it runs. Each batch takes
the same subscription lock as billing and rechecks that entries are still pending.

Usage (from server/):
    uv run python -m scripts.soft_delete_overdue_metered_billing_entries
    uv run python -m scripts.soft_delete_overdue_metered_billing_entries --execute
"""

import asyncio
from datetime import datetime
from typing import Any, cast
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import CursorResult, Select, func, select, type_coerce, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.billing_entry.repository import BillingEntryRepository
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction
from polar.models import (
    BillingEntry,
    Meter,
    Organization,
    ProductPrice,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
console = Console()


def candidate_statement(cutoff: datetime) -> Select[tuple[UUID]]:
    active_price = (
        select(SubscriptionProductPrice.id)
        .where(
            SubscriptionProductPrice.subscription_id == BillingEntry.subscription_id,
            SubscriptionProductPrice.product_price_id == BillingEntry.product_price_id,
            SubscriptionProductPrice.deleted_at.is_(None),
        )
        .correlate(BillingEntry)
        .exists()
    )
    return (
        select(BillingEntry.id)
        .join(Subscription, Subscription.id == BillingEntry.subscription_id)
        .join(ProductPrice, ProductPrice.id == BillingEntry.product_price_id)
        .join(Meter, Meter.id == ProductPrice.__table__.c.meter_id)
        .where(
            BillingEntry.deleted_at.is_(None),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.type == BillingEntryType.metered,
            BillingEntry.created_at <= cutoff,
            BillingEntry.start_timestamp < Subscription.current_period_start,
            Subscription.deleted_at.is_(None),
            Subscription.status == SubscriptionStatus.active,
            type_coerce(Meter.aggregation, JSONB)["func"].astext.in_(
                (AggregationFunction.sum, AggregationFunction.cnt)
            ),
            ~active_price,
        )
    )


async def soft_delete_batch(
    session: AsyncSession,
    subscription_id: UUID,
    period_start: datetime,
    cutoff: datetime,
    batch_size: int,
) -> int:
    await BillingEntryRepository.from_session(session).lock_pending_by_subscription(
        subscription_id
    )
    candidates = (
        candidate_statement(cutoff)
        .where(
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.start_timestamp < period_start,
        )
        .order_by(BillingEntry.id)
        .limit(batch_size)
        .scalar_subquery()
    )
    result = await session.execute(
        update(BillingEntry)
        .where(
            BillingEntry.id.in_(candidates),
            BillingEntry.order_item_id.is_(None),
            BillingEntry.deleted_at.is_(None),
        )
        .values(deleted_at=func.now())
        .execution_options(synchronize_session=False)
    )
    return cast(CursorResult[Any], result).rowcount


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(False, help="Soft delete entries (default: dry-run)"),
    batch_size: int = typer.Option(5000, min=1),
    sleep_seconds: float = typer.Option(0.1, min=0),
) -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    cutoff = utc_now()

    try:
        async with sessionmaker() as session:
            statement = (
                candidate_statement(cutoff)
                .join(Organization, Organization.id == Subscription.organization_id)
                .with_only_columns(
                    Organization.slug,
                    Subscription.id,
                    Subscription.current_period_start,
                    func.count(),
                )
                .group_by(
                    Organization.slug,
                    Subscription.id,
                    Subscription.current_period_start,
                )
                .order_by(Organization.slug, Subscription.id)
            )
            subscriptions = (await session.execute(statement)).all()

        summaries: dict[str, tuple[int, int]] = {}
        for slug, _, _, count in subscriptions:
            subscription_count, entry_count = summaries.get(slug, (0, 0))
            summaries[slug] = (subscription_count + 1, entry_count + count)
        table = Table("Organization", "Subscriptions", "Billing entries")
        for slug, (subscription_count, entry_count) in summaries.items():
            table.add_row(slug, str(subscription_count), str(entry_count))
        console.print(table)
        total = sum(count for _, _, _, count in subscriptions)
        typer.echo(
            f"{total} overdue billing entries across {len(subscriptions)} "
            "active subscriptions."
        )
        if not execute:
            typer.echo("Dry-run — use --execute to waive these charges.")
            return

        updated = 0
        for _, subscription_id, period_start, _ in subscriptions:
            while True:
                async with sessionmaker() as session:
                    count = await soft_delete_batch(
                        session, subscription_id, period_start, cutoff, batch_size
                    )
                    await session.commit()
                updated += count
                if count < batch_size:
                    break
                await asyncio.sleep(sleep_seconds)
            typer.echo(
                f"Subscription {subscription_id}: {updated} entries deleted so far."
            )
            await asyncio.sleep(sleep_seconds)
        typer.echo(f"Soft deleted {updated} overdue billing entries.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

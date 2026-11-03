"""Record the current billing intervals of live subscriptions that have none.

Subscriptions created before interval recording was deployed have no intervals,
so their reducer usage compares as 0. This records each one's current billing
state, starting from when that state took effect.

    uv run python -m scripts.backfill_billing_intervals --dry-run
    uv run python -m scripts.backfill_billing_intervals
"""

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import typer
from sqlalchemy import Select, exists, func, select
from sqlalchemy.orm import with_polymorphic

from polar.billing_interval.service import USAGE_POLICIES
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    BillingInterval,
    Meter,
    ProductPrice,
    ProductPriceMeteredTiers,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()


def subscriptions_without_intervals_statement() -> Select[Subscription]:
    """Live subscriptions with a metered price on an available meter and no
    billing interval."""
    price = with_polymorphic(
        ProductPrice, [ProductPriceMeteredUnit, ProductPriceMeteredTiers]
    )
    return select(Subscription).where(
        ~Subscription.is_deleted,
        Subscription.status.in_(USAGE_POLICIES),
        exists().where(
            SubscriptionProductPrice.subscription_id == Subscription.id,
            ~SubscriptionProductPrice.is_deleted,
            price.id == SubscriptionProductPrice.product_price_id,
            price.is_metered,
            Meter.id == price.ProductPriceMeteredUnit.meter_id,
            Meter.archived_at.is_(None),
            Meter.deleted_at.is_(None),
        ),
        ~exists().where(BillingInterval.subscription_id == Subscription.id),
    )


async def get_subscriptions_without_intervals(
    session: AsyncSession, *, after_id: UUID | None, limit: int, lock: bool
) -> Sequence[Subscription]:
    """The next batch by id, locked for update if `lock`."""
    statement = (
        subscriptions_without_intervals_statement()
        .order_by(Subscription.id)
        .limit(limit)
    )
    if lock:
        statement = statement.with_for_update(of=Subscription)
    if after_id is not None:
        statement = statement.where(Subscription.id > after_id)
    result = await session.execute(statement)
    return result.scalars().unique().all()


async def count_subscriptions_without_intervals(session: AsyncSession) -> int:
    statement = subscriptions_without_intervals_statement().with_only_columns(
        func.count(Subscription.id)
    )
    result = await session.execute(statement)
    return result.scalar_one()


def get_effective_at(subscription: Subscription) -> datetime:
    """When the subscription's current billing state took effect. A pause takes
    effect at the end of the last active period, which pausing doesn't advance,
    unless it paused earlier."""
    if subscription.status == SubscriptionStatus.paused:
        if subscription.paused_at is None:
            return subscription.current_period_end
        return min(subscription.current_period_end, subscription.paused_at)
    return subscription.current_period_start


async def backfill_batch(
    session: AsyncSession, *, after_id: UUID | None, limit: int, dry_run: bool
) -> tuple[int, UUID | None]:
    """Records a batch and returns how many it processed and the last id."""
    subscriptions = await get_subscriptions_without_intervals(
        session, after_id=after_id, limit=limit, lock=not dry_run
    )
    for subscription in subscriptions:
        if not dry_run:
            await billing_interval_service.record_subscription(
                session, subscription, effective_at=get_effective_at(subscription)
            )
    return len(subscriptions), subscriptions[-1].id if subscriptions else None


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(50, min=1),
    dry_run: bool = typer.Option(False, "--dry-run"),
) -> None:
    configure_script_console_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    total = 0
    after_id: UUID | None = None
    try:
        while True:
            async with sessionmaker.begin() as session:
                count, after_id = await backfill_batch(
                    session, after_id=after_id, limit=batch_size, dry_run=dry_run
                )
            total += count
            if count < batch_size:
                break
        async with sessionmaker() as session:
            remaining = await count_subscriptions_without_intervals(session)
        typer.echo(
            f"{'Would process' if dry_run else 'Processed'} {total} subscriptions; "
            f"{remaining} still have no billing interval."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

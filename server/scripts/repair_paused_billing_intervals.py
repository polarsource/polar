"""Record the last active period of paused subscriptions the interval backfill
recorded from their pause only.

Their resume order bills the usage of the period before the pause, which the
reducer can't bill without a charge interval for it.

    uv run python -m scripts.repair_paused_billing_intervals --dry-run
    uv run python -m scripts.repair_paused_billing_intervals
"""

from datetime import datetime

import typer
from sqlalchemy import Select, exists, func, select
from sqlalchemy.orm import aliased

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BillingInterval, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine

from .backfill_billing_intervals import record_active_period
from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()


def paused_from_pause_only_statement() -> Select[Subscription, datetime]:
    """Paused subscriptions whose first interval is the open paused one, with
    when it starts."""
    earlier = aliased(BillingInterval)
    return (
        select(Subscription, func.min(BillingInterval.period_start))
        .join(BillingInterval, BillingInterval.subscription_id == Subscription.id)
        .where(
            ~Subscription.is_deleted,
            Subscription.status == SubscriptionStatus.paused,
            BillingInterval.usage_policy == UsagePolicy.paused,
            BillingInterval.period_end.is_(None),
            ~exists().where(
                earlier.subscription_id == BillingInterval.subscription_id,
                earlier.meter_id == BillingInterval.meter_id,
                earlier.period_start < BillingInterval.period_start,
            ),
        )
        .group_by(Subscription.id)
    )


@cli.command()
@typer_async
async def repair(dry_run: bool = typer.Option(False, "--dry-run")) -> None:
    configure_script_console_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker.begin() as session:
            result = await session.execute(paused_from_pause_only_statement())
            rows = result.all()
            for subscription, paused_from in rows:
                typer.echo(f"{subscription.id}: active until {paused_from}")
                if not dry_run:
                    await record_active_period(session, subscription, until=paused_from)
        typer.echo(
            f"{'Would repair' if dry_run else 'Repaired'} {len(rows)} subscriptions."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

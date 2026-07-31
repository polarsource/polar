"""Find subscriptions whose meters are missing a reset event for the current cycle.

Every cycle, ``subscription.cycle`` emits a ``meter.reset`` system event stamped
at the cycle boundary (see #13483). That event bounds the current period's usage
window. Subscriptions that cycled before #13483 shipped — or otherwise got stuck
retrying their cycle order (the perf issue #13479 fixes) — never got that event,
so their meters have no reset at or after ``current_period_start``.

This script reports those subscriptions. It's read-only; feed the ids it prints
to ``scripts.emit_meter_reset_events`` to emit the missing events.

A meter is considered missing its reset when it has no ``meter.reset`` event with
a timestamp at or after the subscription's ``current_period_start``.

Usage:

    uv run python -m scripts.find_subscriptions_missing_reset_events [--ids-only]

Options:
    --ids-only   print only the subscription ids (one per line), for piping.
"""

import asyncio
import logging.config
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import exists, func

from polar.event.repository import EventRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Subscription, SubscriptionMeter
from polar.postgres import create_async_engine
from polar.subscription.repository import SubscriptionRepository

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


@cli.command()
def find_subscriptions_missing_reset_events(
    ids_only: bool = typer.Option(
        False,
        "--ids-only",
        help="Print only the subscription ids (one per line), for piping.",
    ),
) -> None:
    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as session:
            repository = SubscriptionRepository.from_session(session)
            event_repository = EventRepository.from_session(session)

            statement = (
                repository.get_base_statement()
                .where(
                    Subscription.active.is_(True),
                    exists().where(
                        SubscriptionMeter.subscription_id == Subscription.id
                    ),
                )
                .options(*repository.get_eager_options())
            )
            count = await session.scalar(
                statement.with_only_columns(func.count()).order_by(None)
            )

            missing: list[tuple[Subscription, list[SubscriptionMeter]]] = []
            with Progress(disable=ids_only) as progress:
                task = progress.add_task(
                    "[cyan]Checking metered subscriptions...", total=count
                )
                async for subscription in repository.stream(statement):
                    missing_meters = []
                    for subscription_meter in subscription.meters:
                        latest_reset = await event_repository.get_latest_meter_reset(
                            subscription.customer, subscription_meter.meter_id
                        )
                        if (
                            latest_reset is None
                            or latest_reset.timestamp
                            < subscription.current_period_start
                        ):
                            missing_meters.append(subscription_meter)
                    if missing_meters:
                        missing.append((subscription, missing_meters))
                    progress.advance(task)

            if ids_only:
                for subscription, _ in missing:
                    typer.echo(str(subscription.id))
                return

            if not missing:
                typer.echo("No subscriptions missing reset events. ✨")
                return

            for subscription, missing_meters in missing:
                meter_ids = ", ".join(str(sm.meter_id) for sm in missing_meters)
                typer.echo(
                    f"{subscription.id} "
                    f"(period start {subscription.current_period_start.isoformat()}): "
                    f"{len(missing_meters)} meter(s) missing reset — {meter_ids}"
                )
            typer.echo(
                f"\n{len(missing)} subscription(s) missing reset events. "
                "Emit them with:\n"
                "    uv run python -m scripts.emit_meter_reset_events "
                + " ".join(str(subscription.id) for subscription, _ in missing)
            )

    asyncio.run(run())


if __name__ == "__main__":
    cli()

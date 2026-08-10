"""Manually emit meter reset events for subscriptions that already cycled.

Normally a subscription's meters are reset during ``subscription.cycle`` (see
#13483), which emits a ``meter.reset`` system event (plus a ``meter.credited``
event for any rollover) stamped at the cycle boundary. That reset event is what
bounds the *next* period's usage window and, crucially, keeps the *current*
cycle order from billing usage past the boundary.

Some subscriptions cycled before #13483 shipped and got stuck retrying their
cycle order (the perf issue #13479 fixes). Their cycle already advanced the
period dates, so ``subscription.cycle`` won't run again for them — meaning the
meter reset event that #13483 would have created never gets emitted. Without it,
the eventual order would bill usage all the way up to now instead of stopping at
the cycle date.

This script emits those missing reset events out-of-band, exactly as the cycle
flow would have, using ``current_period_start`` as the reset timestamp (the
cycle boundary the subscription already moved to).

It is idempotent: a meter whose latest reset event is already at or after that
timestamp is skipped, so re-running never emits duplicate resets.

Usage:

    uv run python -m scripts.emit_meter_reset_events <subscription_id>... [--execute]

Defaults to a dry-run; pass --execute to actually emit the events.

Options:
    --execute   actually emit the reset events (default: dry-run)
    --yes       skip the confirmation prompt
"""

import asyncio
import logging.config
import uuid
from datetime import datetime
from typing import Any

import dramatiq
import structlog
import typer

from polar import tasks  # noqa: F401
from polar.event.repository import EventRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Subscription, SubscriptionMeter
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
from polar.worker import JobQueueManager

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
def emit_meter_reset_events(
    subscription_ids: list[uuid.UUID] = typer.Argument(
        ..., help="Subscription id(s) to emit meter reset events for."
    ),
    execute: bool = typer.Option(
        False, "--execute", help="Actually emit the events (default: dry-run)."
    ),
    yes: bool = typer.Option(False, "--yes", help="Skip the confirmation prompt."),
) -> None:
    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        redis = create_redis("app")

        async with (
            JobQueueManager.open(dramatiq.get_broker(), redis) as job_queue_manager,
            sessionmaker() as session,
        ):
            repository = SubscriptionRepository.from_session(session)
            event_repository = EventRepository.from_session(session)

            subscriptions = []
            # Dedupe so passing the same id twice can't emit duplicate resets.
            for subscription_id in dict.fromkeys(subscription_ids):
                subscription = await repository.get_by_id(
                    subscription_id, options=repository.get_eager_options()
                )
                if subscription is None:
                    typer.echo(f"Subscription '{subscription_id}' not found.")
                    raise typer.Exit(code=1)
                subscriptions.append(subscription)

            async def is_already_reset(
                subscription: Subscription,
                subscription_meter: SubscriptionMeter,
                reset_at: datetime,
            ) -> bool:
                # Idempotency guard: skip meters that already have a reset event
                # at or after the boundary, so re-running emits no duplicates.
                latest_reset = await event_repository.get_latest_meter_reset(
                    subscription.customer, subscription_meter.meter_id
                )
                return latest_reset is not None and latest_reset.timestamp >= reset_at

            to_reset: list[tuple[Subscription, SubscriptionMeter, datetime]] = []
            for subscription in subscriptions:
                # Mirror the cycle flow: reset at the boundary the subscription
                # already moved to, never in the future.
                reset_at = min(subscription.current_period_start, utc_now())
                for subscription_meter in subscription.meters:
                    if await is_already_reset(
                        subscription, subscription_meter, reset_at
                    ):
                        typer.echo(
                            f"{subscription.id}: meter {subscription_meter.meter_id} "
                            f"already reset at or after {reset_at.isoformat()}, "
                            "skipping."
                        )
                        continue
                    to_reset.append((subscription, subscription_meter, reset_at))
                    typer.echo(
                        f"{subscription.id}: reset meter "
                        f"{subscription_meter.meter_id} at {reset_at.isoformat()}"
                    )

            if not to_reset:
                typer.echo("Nothing to do — all meters already reset.")
                raise typer.Exit(code=0)

            if not execute:
                typer.echo("Dry run — no events emitted. Pass --execute to apply.")
                raise typer.Exit(code=0)

            if not yes and not typer.confirm("Proceed?"):
                raise typer.Exit(code=1)

            for subscription, subscription_meter, reset_at in to_reset:
                await subscription_service.reset_meter(
                    session, subscription, subscription_meter, reset_at=reset_at
                )

            await session.commit()
            await job_queue_manager.flush(dramatiq.get_broker(), redis)
            typer.echo(f"Emitted {len(to_reset)} meter reset event(s).")

    asyncio.run(run())


if __name__ == "__main__":
    cli()

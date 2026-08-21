"""Find subscriptions stuck without a meter reset for their current cycle.

Every cycle, ``subscription.cycle`` emits a ``meter.reset`` system event stamped
at the cycle boundary (see #13483). That event bounds the current period's usage
window. Subscriptions that got stuck retrying their cycle order (the perf issue
#13479 fixes) never got that event, so their prior-period usage is still pending
and unbounded — it would be billed into the eventual order.

This script reports exactly those subscriptions. It's read-only; feed the ids it
prints to ``scripts.emit_meter_reset_events`` to emit the missing events.

A subscription is reported when, for one of its meters, ALL of the following hold:

  - it is active (trials are excluded — they haven't cycled/billed yet);
  - it has pending (not yet ordered) metered billing entries with a
    ``start_timestamp`` before ``current_period_start`` — i.e. usage from a past
    period the stuck cycle order never rolled up;
  - there is no ``meter.reset`` event for that meter at or after
    ``current_period_start``.

The pending-entries condition is what makes this precise: it targets the actual
over-billing risk and, by construction, only matches subscriptions that have
cycled — so it doesn't flag first-period subscriptions, meters added mid-period,
or early-cycled subscriptions (whose reset is legitimately stamped before the
new period start).

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
from sqlalchemy import String, cast, select

from polar.event.system import SystemEvent
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BillingEntry, Event, Subscription
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.models.product_price import ProductPriceMeteredUnit
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine

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
            # A reset event for this customer + meter at or after the current
            # period start — its absence is what we're looking for.
            reset_exists = (
                select(Event.id)
                .where(
                    Event.customer_id == BillingEntry.customer_id,
                    Event.source == EventSource.system,
                    Event.name == SystemEvent.meter_reset,
                    Event.user_metadata["meter_id"].as_string()
                    == cast(ProductPriceMeteredUnit.meter_id, String),
                    Event.timestamp >= Subscription.current_period_start,
                )
                .exists()
            )

            statement = (
                select(
                    Subscription.id,
                    Subscription.current_period_start,
                    ProductPriceMeteredUnit.meter_id,
                )
                .join(BillingEntry, BillingEntry.subscription_id == Subscription.id)
                .join(
                    ProductPriceMeteredUnit,
                    BillingEntry.product_price_id == ProductPriceMeteredUnit.id,
                )
                .where(
                    Subscription.deleted_at.is_(None),
                    Subscription.status == SubscriptionStatus.active,
                    BillingEntry.deleted_at.is_(None),
                    BillingEntry.order_item_id.is_(None),
                    BillingEntry.type == BillingEntryType.metered,
                    BillingEntry.start_timestamp < Subscription.current_period_start,
                    ~reset_exists,
                )
                .distinct()
                .order_by(Subscription.id)
            )

            result = await session.execute(statement)

            by_subscription: dict[Any, tuple[Any, list[Any]]] = {}
            for subscription_id, current_period_start, meter_id in result:
                _, meter_ids = by_subscription.setdefault(
                    subscription_id, (current_period_start, [])
                )
                meter_ids.append(meter_id)

            if ids_only:
                for subscription_id in by_subscription:
                    typer.echo(str(subscription_id))
                return

            if not by_subscription:
                typer.echo("No subscriptions missing reset events. ✨")
                return

            for subscription_id, (
                current_period_start,
                meter_ids,
            ) in by_subscription.items():
                meters = ", ".join(str(meter_id) for meter_id in meter_ids)
                typer.echo(
                    f"{subscription_id} "
                    f"(period start {current_period_start.isoformat()}): "
                    f"{len(meter_ids)} meter(s) missing reset — {meters}"
                )
            typer.echo(
                f"\n{len(by_subscription)} subscription(s) missing reset events. "
                "Emit them with:\n"
                "    uv run python -m scripts.emit_meter_reset_events "
                + " ".join(str(subscription_id) for subscription_id in by_subscription)
            )

    asyncio.run(run())


if __name__ == "__main__":
    cli()

"""Deletes the meter resets that a later subscription's renewal made on a meter
another subscription owns (ENG-104).

Only a shared meter's owner should reset it, at its own renewals. Before #16528,
and until the meter-credit cycle stopped resetting meters, a later subscription's
renewal reset it too. The customer meter and the reducer then count credits and
usage from that reset, while legacy billing counts them from the owner's renewal.

Deleting those resets makes the owner's reset the latest again. The reducer reads
its buckets from the latest reset, so it needs no rebuild. The customer meter is
recomputed, and the deletion is rolled back unless every side then counts the same
credits.
"""

import json
import math
import uuid
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

import dramatiq
import typer
from sqlalchemy import Select, String, cast, delete, func, literal, or_, select, true
from sqlalchemy.orm import joinedload, with_polymorphic

from polar import tasks  # noqa: F401
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.math import non_negative_running_sum
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    CustomerMeter,
    Event,
    Meter,
    Order,
    ProductPrice,
    ProductPriceMeteredTiers,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.benefit import BenefitType
from polar.models.event import EventSource
from polar.models.order import OrderBillingReasonInternal
from polar.postgres import create_async_engine
from polar.redis import Redis, create_redis
from polar.reducer.service import reducer as reducer_service
from polar.subscription.repository import SubscriptionRepository
from polar.worker import JobQueueManager, enqueue_job

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

# The owner's own reset lands at its renewal, give or take the time to process it.
OWNER_RESET_MARGIN = timedelta(minutes=5)
# How long after its renewal order a subscription's reset was made.
RENEWAL_WINDOW = timedelta(hours=1)
RENEWAL_REASONS = (
    OrderBillingReasonInternal.subscription_create,
    OrderBillingReasonInternal.subscription_cycle,
    OrderBillingReasonInternal.subscription_cycle_after_trial,
)


class DeletionMismatch(Exception):
    pass


def _owner_statement(customer_id: Any, meter_id: Any) -> Select[Subscription, bool]:
    """The subscription that owns the customer's meter, and whether it bills it."""
    price = with_polymorphic(
        ProductPrice, [ProductPriceMeteredUnit, ProductPriceMeteredTiers]
    )
    bills = (
        select(SubscriptionProductPrice.subscription_id)
        .join(price, price.id == SubscriptionProductPrice.product_price_id)
        .where(
            SubscriptionProductPrice.subscription_id == Subscription.id,
            ~SubscriptionProductPrice.is_deleted,
            price.is_metered,
            price.ProductPriceMeteredUnit.meter_id == meter_id,
        )
        .correlate_except(SubscriptionProductPrice, ProductPrice)
        .exists()
    )
    credits = (
        select(BenefitGrant.subscription_id)
        .join(Benefit, Benefit.id == BenefitGrant.benefit_id)
        .where(
            BenefitGrant.subscription_id == Subscription.id,
            BenefitGrant.customer_id == customer_id,
            BenefitGrant.is_granted,
            ~BenefitGrant.is_deleted,
            Benefit.type == BenefitType.meter_credit,
            Benefit.properties["meter_id"].as_string() == cast(meter_id, String),
        )
        .correlate_except(BenefitGrant, Benefit)
        .exists()
    )
    return (
        select(Subscription, bills)
        .where(
            Subscription.customer_id == customer_id,
            Subscription.billable,
            Subscription.ended_at.is_(None),
            or_(bills, credits),
        )
        .order_by(bills.desc(), Subscription.started_at, Subscription.id)
        .limit(1)
    )


async def _get_owner(
    session: AsyncSession, customer: Customer, meter: Meter
) -> tuple[Subscription, bool] | None:
    row = (
        await session.execute(_owner_statement(literal(customer.id), literal(meter.id)))
    ).one_or_none()
    if row is None:
        return None
    owner, owner_bills_meter = row
    if await SubscriptionRepository.from_session(
        session
    ).is_meter_owned_by_other_subscription(
        owner, customer.id, meter.id, bills_meter=owner_bills_meter
    ):
        raise DeletionMismatch(f"subscription {owner.id} doesn't own the meter")
    return owner, owner_bills_meter


async def get_resets_since_owner_renewal(
    session: AsyncSession, customer: Customer, meter: Meter
) -> tuple[Subscription, bool, Sequence[Event]]:
    """The meter's owner, whether it bills the meter, and the resets made since
    its renewal."""
    owned = await _get_owner(session, customer, meter)
    if owned is None:
        raise DeletionMismatch("no subscription owns the meter")
    owner, owner_bills_meter = owned
    renewal = owner.current_meter_period_start or owner.current_period_start
    event_repository = EventRepository.from_session(session)
    resets = await event_repository.get_all(
        event_repository.get_meter_resets_statement(customer, meter.id).where(
            Event.timestamp > renewal + OWNER_RESET_MARGIN
        )
    )
    return owner, owner_bills_meter, resets


async def delete_resets(
    session: AsyncSession, redis: Redis, customer_meter_id: uuid.UUID
) -> dict[str, Any]:
    """Deletes the customer meter's resets made by a later subscription's renewal
    since the owner's, recomputes the customer meter and returns the deleted
    resets with the customer meter's units before and after. Raises if a reset since the owner's renewal isn't from a later
    subscription's renewal, or if the owner's reset, the customer meter, the
    reducer and legacy billing don't agree afterwards."""
    customer_meter = (
        await session.scalars(
            select(CustomerMeter)
            .where(CustomerMeter.id == customer_meter_id)
            .options(
                joinedload(CustomerMeter.customer).joinedload(Customer.organization),
                joinedload(CustomerMeter.meter),
            )
        )
    ).one()
    customer, meter = customer_meter.customer, customer_meter.meter
    owner, owner_bills_meter, resets = await get_resets_since_owner_renewal(
        session, customer, meter
    )
    renewal = owner.current_meter_period_start or owner.current_period_start
    event_repository = EventRepository.from_session(session)
    if not resets:
        return {"deleted": []}
    for reset in resets:
        later_renewal = await session.scalar(
            select(Order.id)
            .join(Subscription, Subscription.id == Order.subscription_id)
            .where(
                Subscription.customer_id == customer.id,
                Subscription.id != owner.id,
                Subscription.started_at > owner.started_at,
                Order.billing_reason.in_(RENEWAL_REASONS),
                Order.created_at.between(
                    reset.timestamp - RENEWAL_WINDOW, reset.timestamp + RENEWAL_WINDOW
                ),
            )
            .limit(1)
        )
        if later_renewal is None:
            raise DeletionMismatch(
                f"reset {reset.id} isn't from a later subscription's renewal"
            )
        rollover = await event_repository.get_one_or_none(
            event_repository.get_base_statement()
            .where(
                Event.organization_id == customer.organization_id,
                Event.customer_id == customer.id,
                Event.name == SystemEvent.meter_credited,
                Event.user_metadata["meter_id"].as_string() == str(meter.id),
                Event.user_metadata["rollover"].as_boolean(),
                Event.timestamp.between(
                    reset.timestamp, reset.timestamp + timedelta(minutes=1)
                ),
            )
            .limit(1)
        )
        if rollover is not None:
            raise DeletionMismatch(f"reset {reset.id} carried over rollover credits")

    deleted = [
        {
            "id": str(reset.id),
            "organization_id": str(reset.organization_id),
            "customer_id": str(reset.customer_id),
            "timestamp": reset.timestamp.isoformat(),
            "ingested_at": reset.ingested_at.isoformat(),
            "user_metadata": reset.user_metadata,
        }
        for reset in resets
    ]
    before = _units(customer_meter)
    reset_ids = [reset.id for reset in resets]
    # The delete would violate the meter's foreign key to its last billed event.
    if await session.scalar(
        select(Meter.id).where(Meter.last_billed_event_id.in_(reset_ids)).limit(1)
    ):
        raise DeletionMismatch("a reset is the meter's last billed event")
    customer_meter.last_balanced_event = None
    await session.flush()
    for reset in resets:
        session.expunge(reset)
    await session.execute(delete(Event).where(Event.id.in_(reset_ids)))

    latest = await event_repository.get_latest_meter_reset(customer, meter.id)
    if latest is None or abs(latest.timestamp - renewal) > OWNER_RESET_MARGIN:
        raise DeletionMismatch("the owner's reset isn't the latest afterwards")
    # A credit reducer backfilled after the deleted resets has no buckets for the
    # credits before them: rebuild the credits since the owner's reset.
    await reducer_service.sync_credits(session, customer, meter.id)

    reducer_billing = await customer_meter_service._is_reducer_billing_enabled(
        session, customer
    )
    customer_meter.consumed_units = await customer_meter_service._get_consumed_units(
        session, redis, customer, meter, reducer_billing=reducer_billing
    )
    customer_meter.credited_units = non_negative_running_sum(
        credit.user_metadata["units"]
        for credit in await customer_meter_service._get_credit_events(
            customer, meter, event_repository
        )
    )
    customer_meter.balance = (
        customer_meter.credited_units - customer_meter.consumed_units
    )
    customer_meter.last_balanced_event = (
        await customer_meter_service._get_latest_current_window_event(
            session, customer, meter
        )
    )
    await session.flush()
    if reducer_billing:
        await customer_meter_service._refresh_subscription_meters(session, customer)

    [(reducer_usage, reducer_credits)] = await reducer_service.get_customer_meter_units(
        session, redis, [(customer, meter.id)]
    )
    # The reducer counts the buckets that start at the latest reset: if it never
    # split them at the owner's reset, it misses the usage since then.
    event_usage = await customer_meter_service._get_usage_quantity(
        session, customer, meter
    )
    if reducer_usage is not None and not math.isclose(reducer_usage, event_usage):
        raise DeletionMismatch(
            f"usage disagrees afterwards: reducer {reducer_usage}, events {event_usage}"
        )
    credits = {
        "customer meter": customer_meter.credited_units,
        "reducer": reducer_credits,
    }
    if owner_bills_meter:
        pending = await event_repository.get_pending_meter_credits(
            owner.id, meter.id, since=None, until=utc_now()
        )
        credits["legacy billing"] = non_negative_running_sum(
            credit.user_metadata["units"]
            for credit in sorted(pending, key=lambda credit: credit.timestamp)
        )
    if len(set(credits.values())) != 1:
        raise DeletionMismatch(f"credits disagree afterwards: {credits}")

    await reducer_service.enqueue_usage_change(session, customer, meter.id)
    enqueue_job("customer.state_changed", customer.id)
    return {"deleted": deleted, "before": before, "after": _units(customer_meter)}


def _units(customer_meter: CustomerMeter) -> dict[str, str]:
    return {
        "consumed": str(customer_meter.consumed_units),
        "credited": str(customer_meter.credited_units),
        "balance": str(customer_meter.balance),
    }


async def find(session: AsyncSession) -> Sequence[uuid.UUID]:
    """The customer meters with a reset since their owner's renewal."""
    owner = (
        _owner_statement(CustomerMeter.customer_id, CustomerMeter.meter_id)
        .with_only_columns(
            func.coalesce(
                Subscription.current_meter_period_start,
                Subscription.current_period_start,
            ).label("renewal")
        )
        .correlate(CustomerMeter)
        .lateral("owner")
    )
    # Only a customer with more than one subscription, live or since ended, can
    # have one reset another's meter.
    shared = (
        select(Subscription.customer_id)
        .group_by(Subscription.customer_id)
        .having(func.count() > 1)
    )
    statement = (
        select(CustomerMeter.id)
        .join(Customer, Customer.id == CustomerMeter.customer_id)
        .join(owner, true())
        .where(
            CustomerMeter.customer_id.in_(shared),
            select(Event.id)
            .where(
                Event.organization_id == Customer.organization_id,
                Event.customer_id == CustomerMeter.customer_id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_reset,
                Event.user_metadata["meter_id"].as_string()
                == cast(CustomerMeter.meter_id, String),
                Event.timestamp > owner.c.renewal + OWNER_RESET_MARGIN,
            )
            .exists(),
        )
        .order_by(CustomerMeter.customer_id, CustomerMeter.meter_id)
    )
    return (await session.scalars(statement)).all()


@cli.command()
@typer_async
async def run(
    customer_meter_id: list[uuid.UUID] | None = typer.Option(
        None, help="Customer meter to fix. Repeatable. Defaults to all affected."
    ),
    execute: bool = typer.Option(False, help="Delete the resets; otherwise roll back."),
) -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    broker = dramatiq.get_broker()
    try:
        ids: Sequence[uuid.UUID] = customer_meter_id or []
        if not ids:
            async with sessionmaker() as session:
                ids = await find(session)
            typer.echo(f"Found {len(ids)} affected customer meters")
        async with JobQueueManager.open(broker, redis) as manager:
            for id in ids:
                async with sessionmaker() as session:
                    try:
                        result = await delete_resets(session, redis, id)
                    except DeletionMismatch as e:
                        await session.rollback()
                        manager.reset()
                        typer.echo(f"{id}: rolled back, {e}")
                        continue
                    if not result["deleted"]:
                        typer.echo(f"{id}: nothing to delete")
                        continue
                    if execute:
                        await session.commit()
                        await manager.flush(broker, redis)
                    else:
                        await session.rollback()
                        manager.reset()
                    typer.echo(
                        f"{id}: {'deleted' if execute else 'would delete'} "
                        + json.dumps(result)
                    )
    finally:
        await redis.aclose()
        await engine.dispose()


if __name__ == "__main__":
    cli()

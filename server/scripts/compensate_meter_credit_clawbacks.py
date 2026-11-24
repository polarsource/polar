"""Compensates meter credits clawed back below zero before #15583.

Legacy floors the running credit total at zero and the credit reducer doesn't, so
they disagree by the overshoot. A credit of the overshoot right before the event
that first drove the total negative makes it land on zero instead: legacy is
unchanged and the reducer catches up.
"""

import uuid
from datetime import timedelta

import dramatiq
import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar import tasks  # noqa: F401
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.event.system import SystemEvent, build_system_event
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.math import non_negative_running_sum
from polar.models import Customer, CustomerMeter
from polar.postgres import create_async_engine
from polar.redis import Redis, create_redis
from polar.reducer.service import reducer as reducer_service
from polar.worker import JobQueueManager

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


class CompensationMismatch(Exception):
    pass


async def compensate(
    session: AsyncSession, redis: Redis, customer_meter_id: uuid.UUID
) -> int:
    """Creates the compensating credit and returns its units, 0 if none is needed.
    Raises if legacy credits or rollover units change, or the reducer doesn't
    match legacy afterwards."""
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
    event_repository = EventRepository.from_session(session)

    credits = await customer_meter_service._get_credit_events(
        customer, meter, event_repository
    )
    running = lowest = 0
    first_negative = None
    for credit in credits:
        running += credit.user_metadata["units"]
        if running < 0 and first_negative is None:
            first_negative = credit
        lowest = min(lowest, running)
    if first_negative is None:
        return 0

    legacy_before = non_negative_running_sum(
        credit.user_metadata["units"] for credit in credits
    )
    rollover_before = await customer_meter_service.get_rollover_units(
        session, customer, meter
    )

    event = build_system_event(
        SystemEvent.meter_credited,
        customer=customer,
        organization=customer.organization,
        metadata={
            "meter_id": str(meter.id),
            "units": -lowest,
            "rollover": first_negative.user_metadata["rollover"],
            "reason": "manual",
        },
        timestamp=first_negative.timestamp - timedelta(microseconds=1),
    )
    event.parent_id = first_negative.id
    event.root_id = first_negative.root_id
    await event_service.create_event(session, event)

    updated, _ = await customer_meter_service.update_customer_meter(
        session, redis, customer, meter
    )
    assert updated is not None
    rollover_after = await customer_meter_service.get_rollover_units(
        session, customer, meter
    )
    [(_, reducer_after)] = await reducer_service.get_customer_meter_units(
        session, redis, [(customer, meter.id)]
    )
    if (
        updated.credited_units != legacy_before
        or rollover_after != rollover_before
        or reducer_after != legacy_before
    ):
        raise CompensationMismatch(
            f"legacy {legacy_before} -> {updated.credited_units}, "
            f"rollover {rollover_before} -> {rollover_after}, "
            f"reducer {reducer_after}"
        )
    return -lowest


@cli.command()
@typer_async
async def run(
    customer_meter_id: list[uuid.UUID] = typer.Option(
        ..., help="Customer meter to compensate. Repeatable."
    ),
    execute: bool = typer.Option(False, help="Write the credits; otherwise roll back."),
) -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    broker = dramatiq.get_broker()
    try:
        async with JobQueueManager.open(broker, redis) as manager:
            for id in customer_meter_id:
                async with sessionmaker() as session:
                    try:
                        units = await compensate(session, redis, id)
                    except CompensationMismatch as e:
                        await session.rollback()
                        manager.reset()
                        typer.echo(f"{id}: rolled back, {e}")
                        continue
                    if execute:
                        await session.commit()
                        await manager.flush(broker, redis)
                    else:
                        await session.rollback()
                        manager.reset()
                    typer.echo(
                        f"{id}: {'credited' if execute else 'would credit'} {units}"
                    )
    finally:
        await redis.close()
        await engine.dispose()


if __name__ == "__main__":
    cli()

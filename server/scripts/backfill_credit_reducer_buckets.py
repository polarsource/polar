import uuid
from collections.abc import Sequence

import dramatiq
import typer
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import CustomerMeter, MeterReducer, Reducer, ReducerBucket
from polar.models.reducer import ReducerKind
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.reducer.service import reducer as reducer_service
from polar.worker import JobQueueManager

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def backfill_batch(
    session: AsyncSession,
    *,
    after: uuid.UUID | None,
    batch_size: int,
    customer_meter_ids: Sequence[uuid.UUID] = (),
) -> uuid.UUID | None:
    """Rebuilds the credit buckets of a batch of customer meters with credits or
    credit buckets, and returns the last one's id."""
    # Credits written to buckets live can bring `credited_units` to zero before the
    # credits they offset are backfilled.
    has_credit_buckets = (
        select(ReducerBucket.id)
        .join(Reducer, Reducer.id == ReducerBucket.reducer_id)
        .join(MeterReducer, MeterReducer.reducer_id == Reducer.id)
        .where(
            Reducer.kind == ReducerKind.credit,
            ReducerBucket.organization_id == Reducer.organization_id,
            MeterReducer.meter_id == CustomerMeter.meter_id,
            ReducerBucket.customer_id == CustomerMeter.customer_id,
        )
        .exists()
    )
    statement = (
        select(CustomerMeter)
        .where(or_(CustomerMeter.credited_units != 0, has_credit_buckets))
        .options(joinedload(CustomerMeter.customer))
        .order_by(CustomerMeter.id)
        .limit(batch_size)
    )
    if customer_meter_ids:
        statement = statement.where(CustomerMeter.id.in_(customer_meter_ids))
    if after is not None:
        statement = statement.where(CustomerMeter.id > after)
    customer_meters = (await session.scalars(statement)).all()
    for customer_meter in customer_meters:
        await reducer_service.sync_credits(
            session, customer_meter.customer, customer_meter.meter_id
        )
    return customer_meters[-1].id if customer_meters else None


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(100, help="Customer meters per transaction"),
    customer_meter_id: list[uuid.UUID] = typer.Option(
        [], help="Only these customer meters. Repeatable."
    ),
) -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    broker = dramatiq.get_broker()
    after: uuid.UUID | None = None
    try:
        # Seals enqueue outpost events: without a manager they fail and roll back.
        async with JobQueueManager.open(broker, redis) as manager:
            while True:
                async with sessionmaker.begin() as session:
                    last = await backfill_batch(
                        session,
                        after=after,
                        batch_size=batch_size,
                        customer_meter_ids=customer_meter_id,
                    )
                if last is None:
                    break
                await manager.flush(broker, redis)
                after = last
                typer.echo(f"Rebuilt up to customer meter {last}")
    finally:
        await redis.close()
        await engine.dispose()


if __name__ == "__main__":
    cli()

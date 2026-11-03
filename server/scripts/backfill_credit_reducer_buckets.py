import uuid

import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import CustomerMeter
from polar.postgres import create_async_engine
from polar.reducer.service import reducer as reducer_service

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def backfill_batch(
    session: AsyncSession, *, after: uuid.UUID | None, batch_size: int
) -> uuid.UUID | None:
    """Rebuilds the credit buckets of a batch of customer meters with credits, and
    returns the last one's id."""
    statement = (
        select(CustomerMeter)
        .where(CustomerMeter.credited_units != 0)
        .options(joinedload(CustomerMeter.customer))
        .order_by(CustomerMeter.id)
        .limit(batch_size)
    )
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
) -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    after: uuid.UUID | None = None
    try:
        while True:
            async with sessionmaker.begin() as session:
                last = await backfill_batch(session, after=after, batch_size=batch_size)
            if last is None:
                break
            after = last
            typer.echo(f"Rebuilt up to customer meter {last}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

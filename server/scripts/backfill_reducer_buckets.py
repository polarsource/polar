from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

import typer
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.meter.aggregation import UniqueAggregation
from polar.models import MeterReducer, Reducer
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def get_reducers(
    session: AsyncSession, *, organization_id: UUID | None, meter_id: UUID | None
) -> Sequence[Reducer]:
    statement = select(Reducer).where(Reducer.deleted_at.is_(None))
    if organization_id is not None:
        statement = statement.where(Reducer.organization_id == organization_id)
    if meter_id is not None:
        statement = statement.join(MeterReducer).where(
            MeterReducer.meter_id == meter_id
        )
    return (await session.scalars(statement)).all()


@cli.command()
@typer_async
async def backfill(
    start: datetime,
    end: datetime,
    organization_id: UUID | None = None,
    meter_id: UUID | None = None,
) -> None:
    """Rebuild usage and billing buckets, excluding the latest ten minutes."""
    start = start.replace(tzinfo=UTC)
    end = min(end.replace(tzinfo=UTC), utc_now() - timedelta(minutes=10))
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            reducers = await get_reducers(
                session, organization_id=organization_id, meter_id=meter_id
            )
        typer.echo(f"Backfilling [{start.isoformat()}, {end.isoformat()})")
        for reducer in reducers:
            if isinstance(reducer.aggregation, UniqueAggregation):
                typer.echo(f"Skipping unique reducer {reducer.id}")
                continue
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

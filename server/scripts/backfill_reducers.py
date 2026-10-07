import typer

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import reducer as reducer_service

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def backfill_batch(
    session: AsyncSession, *, batch_size: int = 100
) -> tuple[int, int]:
    repository = ReducerRepository.from_session(session)
    meters = await repository.get_meters_without_reducers(limit=batch_size)

    for meter in meters:
        await reducer_service.sync_meter(session, meter)

    await session.flush()
    deleted = await repository.delete_without_meters(limit=batch_size)
    return len(meters), deleted


@cli.command()
@typer_async
async def backfill() -> None:
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    total_created = total_deleted = 0
    try:
        while True:
            async with sessionmaker.begin() as session:
                created, deleted = await backfill_batch(session)
            total_created += created
            total_deleted += deleted
            if created == 0 and deleted == 0:
                break
        typer.echo(
            f"Created {total_created} reducers; deleted {total_deleted} orphaned reducers."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import HeldBalance, Organization
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job

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


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def held_balance_release() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with sessionmaker() as session:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            statement = select(Organization.id).where(
                Organization.id.in_(
                    select(HeldBalance.organization_id).where(
                        HeldBalance.organization_id.is_not(None)
                    )
                )
            )

            count_statement = statement.with_only_columns(func.count()).order_by(None)
            result = await session.execute(count_statement)
            total_organizations = result.scalar_one()

            with Progress() as progress:
                task = progress.add_task(
                    "[cyan]Enqueuing held balances release...",
                    total=total_organizations,
                )
                organizations = await session.stream_scalars(
                    statement, execution_options={"yield_per": 100}
                )
                async for organization_id in organizations:
                    enqueue_job(
                        "organization.held_balance_release",
                        organization_id=organization_id,
                    )
                    progress.update(task, advance=1)

            await session.commit()
            await manager.flush(dramatiq.get_broker(), redis)


if __name__ == "__main__":
    cli()

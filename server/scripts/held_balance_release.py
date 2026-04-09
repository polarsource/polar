import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.held_balance.service import held_balance as held_balance_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import HeldBalance, Organization
from polar.postgres import create_async_engine
from polar.redis import create_redis
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
            statement = (
                select(Organization)
                .where(
                    Organization.id.in_(
                        select(HeldBalance.organization_id).where(
                            HeldBalance.organization_id.is_not(None)
                        )
                    )
                )
                .options(joinedload(Organization.account))
            )

            with Progress() as progress:
                result = await session.execute(statement)
                organizations = result.scalars().all()
                task = progress.add_task(
                    "[cyan]Releasing held balances...", total=len(organizations)
                )
                for organization in organizations:
                    await held_balance_service.release_account(
                        session, organization.account
                    )
                    progress.update(task, advance=1)

            await session.commit()
            await manager.flush(dramatiq.get_broker(), redis)


if __name__ == "__main__":
    cli()

import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select

from polar import tasks  # noqa: F401
from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Subscription
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
async def cancel_subscriptions_deleted_customers() -> None:
    """Cancel all subscriptions for customers that have been deleted."""
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    async with JobQueueManager.open(dramatiq.get_broker(), redis) as job_queue_manager:
        async with sessionmaker() as session:
            statement = select(Customer).where(
                Customer.deleted_at.is_(True),
                Customer.id.in_(
                    select(Subscription.customer_id).where(
                        Subscription.active.is_(True)
                    )
                ),
            )
            count_statement = statement.with_only_columns(func.count()).order_by(None)
            count_result = await session.execute(count_statement)
            count = count_result.scalar_one()

            repository = CustomerRepository.from_session(session)
            with Progress() as progress:
                async for customer in repository.stream(statement):
                    task = progress.add_task(
                        "[cyan]Enqueuing cancellation jobs...", total=count
                    )
                    enqueue_job("subscription.cancel_customer", customer_id=customer.id)
                    progress.advance(task)

            await session.commit()
            await job_queue_manager.flush(dramatiq.get_broker(), redis)


if __name__ == "__main__":
    cli()

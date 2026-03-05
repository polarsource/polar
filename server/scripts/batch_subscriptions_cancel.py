import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from pydantic import UUID4
from rich.progress import Progress
from sqlalchemy import func, select

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Subscription
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
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
async def batch_subscriptions_cancel(
    organization_id: UUID4 = typer.Argument(
        ..., help="Organization ID to cancel subscriptions for"
    ),
) -> None:
    """Cancel all active subscriptions for the specified organization ID."""
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    async with JobQueueManager.open(dramatiq.get_broker(), redis) as job_queue_manager:
        async with sessionmaker() as session:
            organization_repository = OrganizationRepository.from_session(session)
            organization = await organization_repository.get_by_id(organization_id)

            if organization is None:
                typer.echo(
                    f"Error: Organization with ID {organization} not found", err=True
                )
                raise typer.Exit(1)

            subscription_repository = SubscriptionRepository.from_session(session)
            subscription_statement = (
                select(Subscription)
                .join(Subscription.customer)
                .where(
                    Customer.organization_id == organization_id,
                    Subscription.billable.is_(True),
                )
            )

            total_statement = subscription_statement.with_only_columns(
                func.count()
            ).order_by(None)
            total_result = await session.execute(total_statement)
            total = total_result.scalar_one()

            subscription_ids: set[UUID4] = set()

            with Progress() as progress:
                task = progress.add_task(
                    "[cyan]Cancelling subscriptions...", total=total
                )

                async for subscription in subscription_repository.stream(
                    subscription_statement.options(
                        *subscription_repository.get_eager_options()
                    )
                ):
                    await subscription_service._perform_cancellation(
                        session,
                        subscription,
                        immediately=True,
                    )
                    subscription_ids.add(subscription.id)
                    progress.advance(task)

                progress.remove_task(task)

            await session.commit()
            await job_queue_manager.flush(dramatiq.get_broker(), redis)


if __name__ == "__main__":
    cli()

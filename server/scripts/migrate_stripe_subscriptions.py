import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from pydantic import UUID4
from rich.progress import Progress
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Organization, Product, Subscription
from polar.postgres import create_async_engine
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionNotReadyForMigration
from polar.subscription.service import subscription as subscription_service

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
async def migrate_subscriptions(
    subscription_id: UUID4 | None = typer.Option(
        None, help="If set, only migrate this subscription"
    ),
    max_subscriptions_count: int | None = typer.Option(
        None, help="Maximum number of subscriptions per organization to process"
    ),
    limit: int | None = typer.Option(
        None, help="Maximum number of organizations to process"
    ),
    subscriptions_limit: int | None = typer.Option(
        None, help="Maximum number of subscriptions to process"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        subscription_repository = SubscriptionRepository.from_session(session)

        if subscription_id is not None:
            subscriptions_statement = (
                subscription_repository.get_base_statement().where(
                    Subscription.id == subscription_id
                )
            ).options(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.discount),
                joinedload(Subscription.customer).joinedload(Customer.organization),
            )
        else:
            # Build organizations statement to find candidates
            organizations_statement = (
                select(Organization.id)
                .join(Product, Product.organization_id == Organization.id, isouter=True)
                .join(
                    Subscription,
                    Subscription.product_id == Product.id,
                    isouter=True,
                )
                .where(
                    Subscription.stripe_subscription_id.is_not(None),
                )
                .group_by(Organization.id)
                .having(func.count(Subscription.id) < max_subscriptions_count)
                .order_by(func.count(Subscription.id).asc())
                .limit(limit)
            )

            # Get subscriptions to migrate
            subscriptions_statement = (
                subscription_repository.get_base_statement()
                .join(Customer, Customer.id == Subscription.customer_id)
                .where(
                    Subscription.stripe_subscription_id.is_not(None),
                    Customer.organization_id.in_(organizations_statement),
                )
            )
            if subscriptions_limit is not None:
                subscriptions_statement = subscriptions_statement.limit(
                    subscriptions_limit
                )

        # Count total subscriptions
        count_statement = subscriptions_statement.with_only_columns(
            func.count()
        ).order_by(None)
        total_count = (await session.execute(count_statement)).scalar_one()

        if total_count == 0:
            typer.echo("No subscriptions to migrate")
            await engine.dispose()
            raise typer.Exit(0)

        # Process subscriptions with progress bar
        subscriptions = await subscription_repository.get_all(subscriptions_statement)

        success_count = 0
        skip_count = 0

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Migrating subscriptions...", total=total_count
            )

            for subscription in subscriptions:
                try:
                    await subscription_service.migrate_stripe_subscription(
                        session, subscription
                    )
                    success_count += 1
                except SubscriptionNotReadyForMigration:
                    # Skip subscriptions not ready for migration
                    skip_count += 1

                progress.update(task, advance=1)

        typer.echo("\n---\n")
        typer.echo(f"Successfully migrated: {success_count}")
        typer.echo(f"Skipped (not ready): {skip_count}")
        typer.echo("\n---\n")

        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    cli()

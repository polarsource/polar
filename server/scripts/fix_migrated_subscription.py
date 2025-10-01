import asyncio
import itertools
import logging.config
import random
from functools import wraps
from typing import Any
from uuid import UUID

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import bindparam, func, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Subscription
from polar.postgres import create_async_engine

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


async def process_subscription(
    subscription: tuple[UUID, str], retry: int = 1
) -> tuple[UUID, str, bool]:
    id, stripe_id = subscription
    try:
        async with semaphore:
            stripe_subscription = await stripe_lib.Subscription.retrieve_async(
                stripe_id
            )
            return id, stripe_id, stripe_subscription.ended_at is None
    except stripe_lib.InvalidRequestError as e:
        if "No such subscription" in str(e):
            return id, stripe_id, False
        raise
    except stripe_lib.RateLimitError:
        await asyncio.sleep(retry + random.random())
        return await process_subscription(subscription, retry=retry + 1)


semaphore = asyncio.Semaphore(32)


@cli.command()
@typer_async
async def payments_import(stripe_api_key: str, limit: int, offset: int) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    with Progress() as progress:
        async with sessionmaker() as session:
            statement = (
                select(
                    Subscription.id,
                    Subscription.legacy_stripe_subscription_id,
                    Subscription.created_at,
                )
                .where(
                    Subscription.legacy_stripe_subscription_id.is_not(None),
                )
                .order_by(Subscription.created_at.asc())
            )
            count_statement = statement.with_only_columns(func.count()).order_by(None)
            count = min(limit, (await session.execute(count_statement)).scalar_one())
            subscriptions_progress = progress.add_task(
                "[red]Processing subscriptions...", total=count
            )
            subscriptions = await session.stream(
                statement.limit(limit).offset(offset),
                execution_options={"yield_per": 100},
            )
            tasks: list[asyncio.Task[tuple[UUID, str, bool]]] = []
            async with asyncio.TaskGroup() as tg:
                async for subscription in subscriptions:
                    id, stripe_id, _ = subscription._tuple()
                    assert stripe_id is not None
                    task = tg.create_task(process_subscription((id, stripe_id)))
                    task.add_done_callback(
                        lambda _: progress.update(subscriptions_progress, advance=1)
                    )
                    tasks.append(task)

        progress.stop_task(subscriptions_progress)
        commit_task = progress.add_task("[green]Committing...", total=len(tasks))

        async with sessionmaker() as session:
            connection = await session.connection()
            for batch in itertools.batched(tasks, 1000):
                batch_update: list[dict[str, Any]] = []
                for task in batch:
                    id, stripe_id, should_swap = task.result()
                    if should_swap:
                        batch_update.append(
                            {
                                "s_id": id,
                                "stripe_subscription_id": stripe_id,
                                "legacy_stripe_subscription_id": None,
                            }
                        )
                if batch_update:
                    await connection.execute(
                        update(Subscription).where(
                            Subscription.id == bindparam("s_id")
                        ),
                        batch_update,
                    )
                progress.update(commit_task, advance=len(batch))
            await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    cli()

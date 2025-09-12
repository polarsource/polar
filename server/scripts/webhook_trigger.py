import asyncio
import logging.config
from datetime import datetime
from functools import wraps
from typing import Any
from uuid import UUID

import dramatiq
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select
from sqlalchemy.util.typing import TypedDict

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import WebhookDelivery, WebhookEvent
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


class WebhookEventUpdate(TypedDict):
    w_id: UUID
    payload: str


@cli.command()
@typer_async
async def webhook_trigger(newer_than: datetime) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with sessionmaker() as session:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            statement = (
                select(WebhookEvent.id)
                .join(
                    WebhookDelivery,
                    onclause=WebhookDelivery.webhook_event_id == WebhookEvent.id,
                    isouter=True,
                )
                .where(
                    WebhookDelivery.id.is_(None),
                    WebhookEvent.created_at >= newer_than,
                    WebhookEvent.payload.is_not(None),
                )
            )

            count_statement = statement.with_only_columns(func.count(WebhookEvent.id))
            result = await session.execute(count_statement)
            count = result.scalar_one()

            events = await session.stream(
                statement, execution_options={"yield_per": 1000}
            )
            with Progress() as progress:
                task = progress.add_task("[green]Processing...", total=count)
                async for event in events:
                    event_id = event._tuple()[0]
                    manager.enqueue_job("webhook_event.send", webhook_event_id=event_id)
                    progress.advance(task)


if __name__ == "__main__":
    cli()

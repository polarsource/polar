import asyncio
import itertools
import json
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import bindparam, func, select, update
from sqlalchemy.util.typing import TypedDict

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import WebhookEvent
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


class WebhookEventUpdate(TypedDict):
    w_id: UUID
    payload: str


@cli.command()
@typer_async
async def webhook_events_timestamp() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        count_statement = select(func.count(WebhookEvent.id)).where(
            WebhookEvent.payload.is_not(None)
        )
        result = await session.execute(count_statement)
        count = result.scalar_one()

        statement = select(
            WebhookEvent.id, WebhookEvent.created_at, WebhookEvent.payload
        ).where(WebhookEvent.payload.is_not(None))
        events = await session.stream(statement, execution_options={"yield_per": 1000})
        with Progress() as progress:
            task = progress.add_task("[green]Processing...", total=count)
            results_map: list[WebhookEventUpdate] = []
            async for event in events:
                event_id, created_at, raw_payload = event._tuple()

                assert raw_payload is not None
                payload = json.loads(event.payload)
                payload["timestamp"] = created_at.isoformat()
                results_map.append({"w_id": event_id, "payload": json.dumps(payload)})
                progress.update(task, advance=1)

            progress.stop_task(task)
            commit_task = progress.add_task(
                "[green]Committing...", total=len(results_map)
            )
            connection = await session.connection()
            for batch in itertools.batched(results_map, 1000):
                await connection.execute(
                    update(WebhookEvent).where(WebhookEvent.id == bindparam("w_id")),
                    batch,
                )
                progress.update(commit_task, advance=len(batch))
            await session.commit()


if __name__ == "__main__":
    cli()

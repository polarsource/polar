import asyncio
from functools import wraps

import typer
from sqlalchemy import select, update

from polar.models.webhook_endpoint import WebhookEndpoint
from polar.models.webhook_event import WebhookEvent
from polar.version import CURRENT_API_VERSION
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill_webhook_api_version(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(WebhookEndpoint)
            .values(api_version=CURRENT_API_VERSION)
            .where(
                WebhookEndpoint.id.in_(
                    select(WebhookEndpoint.id)
                    .where(WebhookEndpoint.api_version.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )
    await run_batched_update(
        (
            update(WebhookEvent)
            .values(api_version=CURRENT_API_VERSION)
            .where(
                WebhookEvent.id.in_(
                    select(WebhookEvent.id)
                    .where(WebhookEvent.api_version.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

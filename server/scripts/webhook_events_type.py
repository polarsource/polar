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
from sqlalchemy import bindparam, delete, func, select, update
from sqlalchemy.util.typing import TypedDict

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import WebhookEvent
from polar.models.webhook_endpoint import WebhookEventType
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
    type: WebhookEventType


@cli.command()
@typer_async
async def webhook_events_type() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        count_statement = select(func.count(WebhookEvent.id)).where(
            WebhookEvent.type.is_(None)
        )
        result = await session.execute(count_statement)
        count = result.scalar_one()

        statement = select(WebhookEvent.id, WebhookEvent.payload).where(
            WebhookEvent.type.is_(None)
        )
        events = await session.stream(statement, execution_options={"yield_per": 1000})
        with Progress() as progress:
            task = progress.add_task("[green]Processing...", total=count)
            results_map: list[WebhookEventUpdate] = []
            async for event in events:
                event_id, raw_payload = event._tuple()

                assert raw_payload is not None
                payload = json.loads(event.payload)

                type = (
                    payload.get("type") or payload.get("content") or payload.get("text")
                )
                if type not in {
                    "checkout.created",
                    "checkout.updated",
                    "customer.created",
                    "customer.updated",
                    "customer.deleted",
                    "customer.state_changed",
                    "order.created",
                    "order.updated",
                    "order.paid",
                    "order.refunded",
                    "subscription.created",
                    "subscription.updated",
                    "subscription.active",
                    "subscription.canceled",
                    "subscription.uncanceled",
                    "subscription.revoked",
                    "refund.created",
                    "refund.updated",
                    "product.created",
                    "product.updated",
                    "benefit.created",
                    "benefit.updated",
                    "benefit_grant.created",
                    "benefit_grant.cycled",
                    "benefit_grant.updated",
                    "benefit_grant.revoked",
                    "organization.updated",
                    "pledge.updated",
                    "pledge.created",
                }:
                    match type:
                        case "subscription_tier.updated":
                            type = "product.updated"
                        case "New Order":
                            type = "order.created"
                        case "Order Refunded":
                            type = "order.refunded"
                        case "New Subscription":
                            type = "subscription.created"
                        case "Subscription is now active.":
                            type = "subscription.active"
                        case "Subscription has been canceled.":
                            type = "subscription.canceled"
                        case "Subscription has been cancelled.":
                            type = "subscription.canceled"
                        case "Subscription has been uncanceled.":
                            type = "subscription.uncanceled"
                        case "Subscription has been revoked.":
                            type = "subscription.revoked"
                        case "Refund Created":
                            type = "refund.created"
                        case "Refund Updated":
                            type = "refund.updated"
                        case "New Donation Received":
                            type = "pledge.created"
                        case "New Pledge Received":
                            type = "pledge.created"

                try:
                    results_map.append(
                        {
                            "w_id": event_id,
                            "type": WebhookEventType(type),
                        }
                    )
                except ValueError:
                    await session.execute(
                        delete(WebhookEvent).where(WebhookEvent.id == event_id)
                    )

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

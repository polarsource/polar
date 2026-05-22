import json
import uuid
from datetime import datetime
from typing import cast

import dramatiq
import structlog
import typer
from sqlalchemy import select

from polar import tasks  # noqa: F401
from polar.event.service import event as event_service
from polar.event.system import (
    BalanceCreditOrderMetadata,
    SystemEvent,
    build_system_event,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Event, Organization
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager
from scripts.helper import typer_async

log = structlog.get_logger()
cli = typer.Typer()


@cli.command()
@typer_async
async def write(
    organization_id: uuid.UUID = typer.Option(..., help="Organization UUID"),
    customer_id: uuid.UUID = typer.Option(..., help="Customer UUID"),
    timestamp: str = typer.Option(..., help="Event timestamp in ISO 8601 format"),
    metadata: str = typer.Option(
        ...,
        help='JSON string of user_metadata, e.g. \'{"fee": 0, "amount": -1500, '
        '"currency": "usd", "order_id": "...", "product_id": "...", '
        '"tax_amount": -375, "tax_country": "DK", "subscription_id": "..."}\'',
    ),
    dry_run: bool = True,
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    user_metadata = json.loads(metadata)
    parsed_timestamp = datetime.fromisoformat(timestamp)

    async with (
        JobQueueManager.open(dramatiq.get_broker(), redis),
        sessionmaker() as session,
    ):
        organization = await session.get(Organization, organization_id)
        if organization is None:
            typer.echo(f"Organization {organization_id} not found")
            raise typer.Exit(1)

        customer = await session.get(Customer, customer_id)
        if customer is None:
            typer.echo(f"Customer {customer_id} not found")
            raise typer.Exit(1)

        order_id = user_metadata.get("order_id")
        amount = user_metadata.get("amount")
        if order_id is not None and amount is not None:
            existing = await session.scalar(
                select(Event.id).where(
                    Event.source == "system",
                    Event.organization_id == organization.id,
                    Event.user_metadata["order_id"].astext == str(order_id),
                    Event.user_metadata["amount"].astext == str(amount),
                    Event.name == SystemEvent.balance_credit_order.value,
                )
            )
            if existing is not None:
                typer.echo(
                    f"balance.credit_order with order_id={order_id} amount={amount} "
                    f"already exists (event {existing}). Aborting."
                )
                raise typer.Exit(0)

        typer.echo(f"Organization: {organization.slug} ({organization.id})")
        typer.echo(f"Customer:     {customer.id}")
        typer.echo(f"Timestamp:    {parsed_timestamp.isoformat()}")
        typer.echo(f"Metadata:     {json.dumps(user_metadata, indent=2)}")

        if dry_run:
            typer.echo("\nDry run — pass --no-dry-run to write.")
            return

        event = build_system_event(
            SystemEvent.balance_credit_order,
            customer=customer,
            organization=organization,
            metadata=cast(BalanceCreditOrderMetadata, user_metadata),
        )
        event.timestamp = parsed_timestamp
        await event_service.create_event(session, event)
        await session.commit()
        typer.echo(f"\nCreated balance.credit_order event {event.id}")


if __name__ == "__main__":
    cli()

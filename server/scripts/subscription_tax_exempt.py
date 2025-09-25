import asyncio
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from sqlalchemy import select

from polar.integrations.stripe.service import stripe_lib  # type: ignore[attr-defined]
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Subscription
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


@cli.command()
@typer_async
async def subscription_tax_exempt(
    id: UUID | None = typer.Option(
        None, help="Subscription ID to mark as tax exempted."
    ),
    country: str | None = typer.Option(
        None, help="Country of the subscription to mark as tax exempted."
    ),
    state: str | None = typer.Option(
        None, help="State of the subscription to mark as tax exempted."
    ),
) -> None:
    if not any((id, country, state)):
        typer.echo(
            typer.style(
                "You must specify at least one of the following: subscription ID or country/state.",
                fg="red",
            )
        )
        raise typer.Exit(1)

    if id is not None and any((country, state)):
        typer.echo(
            typer.style(
                "You can either specify a subscription ID or a country and state, not both.",
                fg="red",
            )
        )
        raise typer.Exit(1)

    if country in {"US", "CA"} and state is None:
        typer.echo(
            typer.style(
                "You must specify a state for US and CA subscriptions.",
                fg="red",
            )
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        subscriptions_statement = (
            select(Subscription)
            .join(Subscription.customer)
            .where(
                Subscription.billable.is_(True),
                Subscription.tax_exempted.is_(False),
            )
        )
        if id is not None:
            subscriptions_statement = subscriptions_statement.where(
                Subscription.id == id
            )
        if country is not None:
            subscriptions_statement = subscriptions_statement.where(
                Customer.billing_address["country"].as_string() == country
            )
        if state is not None:
            subscriptions_statement = subscriptions_statement.where(
                Customer.billing_address["state"].as_string() == f"{country}-{state}"
            )

        subscriptions = await session.stream_scalars(subscriptions_statement)
        async for subscription in subscriptions:
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling Subscription {subscription.id}")

            if subscription.stripe_subscription_id is not None:
                await stripe_lib.Subscription.modify_async(
                    subscription.stripe_subscription_id,
                    automatic_tax={"enabled": False},
                )

            subscription.tax_exempted = True
            session.add(subscription)
            await session.commit()


if __name__ == "__main__":
    cli()

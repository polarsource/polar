import asyncio
import logging.config
from collections.abc import Callable
from datetime import UTC, datetime
from functools import wraps
from typing import Any

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress

from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.models import Payment
from polar.payment.service import UnhandledPaymentIntent, UnlinkedPaymentError
from polar.payment.service import payment as payment_service
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


async def process_charges(
    tg: asyncio.TaskGroup, sessionmaker: AsyncSessionMaker, cb: Callable[..., None]
) -> list[asyncio.Task[Payment | None]]:
    tasks: list[asyncio.Task[Payment | None]] = []
    charges = await stripe_lib.Charge.list_async(limit=100)
    async for charge in charges.auto_paging_iter():
        task = tg.create_task(process_charge(sessionmaker, charge))
        task.add_done_callback(cb)
        tasks.append(task)
    return tasks


async def process_intents(
    tg: asyncio.TaskGroup, sessionmaker: AsyncSessionMaker, cb: Callable[..., None]
) -> list[asyncio.Task[Payment | None]]:
    tasks: list[asyncio.Task[Payment | None]] = []
    intents = await stripe_lib.PaymentIntent.list_async(limit=100)
    async for intent in intents.auto_paging_iter():
        task = tg.create_task(process_intent(sessionmaker, intent))
        task.add_done_callback(cb)
        tasks.append(task)
    return tasks


async def process_charge(
    sessionmaker: AsyncSessionMaker, charge: stripe_lib.Charge
) -> Payment | None:
    if not charge.metadata.get("checkout_id") and charge.invoice is None:
        return None
    async with semaphore:
        async with sessionmaker() as session:
            try:
                payment = await payment_service.upsert_from_stripe_charge(
                    session, charge, None, None, None
                )
                payment.created_at = datetime.fromtimestamp(charge.created, tz=UTC)
                return payment
            except UnlinkedPaymentError:
                return None


async def process_intent(
    sessionmaker: AsyncSessionMaker, intent: stripe_lib.PaymentIntent
) -> Payment | None:
    async with semaphore:
        async with sessionmaker() as session:
            try:
                payment = await payment_service.upsert_from_stripe_payment_intent(
                    session, intent, None, None
                )
                payment.created_at = datetime.fromtimestamp(intent.created, tz=UTC)
                return payment
            except (UnlinkedPaymentError, UnhandledPaymentIntent):
                return None


semaphore = asyncio.Semaphore(256)


@cli.command()
@typer_async
async def payments_import(
    stripe_api_key: str,
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    with Progress() as progress:
        async with asyncio.TaskGroup() as tg:
            charges_progress = progress.add_task(
                "[red]Processing charges...", total=None
            )
            intents_progress = progress.add_task(
                "[red]Processing payment intents...", total=None
            )

            async with asyncio.TaskGroup() as tg2:
                charges_task = tg2.create_task(
                    process_charges(
                        tg,
                        sessionmaker,
                        lambda _: progress.update(charges_progress, advance=1),
                    )
                )
                intents_task = tg2.create_task(
                    process_intents(
                        tg,
                        sessionmaker,
                        lambda _: progress.update(intents_progress, advance=1),
                    )
                )

            charges_tasks = charges_task.result()
            progress.update(charges_progress, total=len(charges_tasks))
            progress.start_task(charges_progress)

            intents_tasks = intents_task.result()
            progress.update(intents_progress, total=len(intents_tasks))
            progress.start_task(intents_progress)

    async with sessionmaker() as session:
        charges_count = 0
        for task in charges_tasks:
            payment = task.result()
            if payment is not None:
                await session.merge(payment)
                charges_count += 1

        typer.echo(f"Added {charges_count} charges to the session")
        typer.echo("\n---\n")

        intents_count = 0
        for task in intents_tasks:
            payment = task.result()
            if payment is not None:
                await session.merge(payment)
                intents_count += 1

        typer.echo(f"Added {intents_count} payment intents to the session")
        typer.echo("\n---\n")

        if dry_run:
            await session.flush()
            await session.rollback()
            typer.echo(
                typer.style("Dry run, changes were not saved to the DB", fg="yellow")
            )
        else:
            await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    cli()

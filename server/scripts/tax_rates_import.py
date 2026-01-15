import asyncio
import logging.config
import random
from asyncio.tasks import Task
from functools import wraps
from typing import Any, cast

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.util.typing import TypedDict

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Order
from polar.postgres import create_async_engine
from polar.tax.calculation import TaxabilityReason, TaxRate
from polar.tax.calculation.stripe import from_stripe_tax_rate
from polar.tax.tax_id import TaxID, TaxIDFormat

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


def typer_async(f):
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


semaphore = asyncio.Semaphore(128)


class MigratedOrder(TypedDict):
    order: Order
    tax_rate: TaxRate | None
    taxability_reason: TaxabilityReason | None
    tax_id: TaxID | None


async def migrate_order(order: Order, retry: int = 1) -> MigratedOrder:
    stripe_invoice_id = order.stripe_invoice_id
    assert stripe_invoice_id is not None

    try:
        async with semaphore:
            invoice = await stripe_lib.Invoice.retrieve_async(
                stripe_invoice_id, expand=["total_tax_amounts.tax_rate"]
            )
    except stripe_lib.RateLimitError:
        await asyncio.sleep(retry + random.random())
        return await migrate_order(order, retry=retry + 1)
    except stripe_lib.InvalidRequestError:
        return {
            "order": order,
            "tax_rate": None,
            "taxability_reason": None,
            "tax_id": None,
        }

    tax_id: TaxID | None = None
    if invoice.customer_tax_ids:
        customer_tax_id = invoice.customer_tax_ids[0]
        if customer_tax_id.value:
            tax_id = customer_tax_id.value, TaxIDFormat(customer_tax_id.type)

    taxability_reason: TaxabilityReason | None = None
    tax_rate: TaxRate | None = None
    for total_tax_amount in invoice.total_tax_amounts:
        taxability_reason = TaxabilityReason.from_stripe(
            total_tax_amount.taxability_reason, invoice.tax or 0
        )
        stripe_tax_rate = cast(stripe_lib.TaxRate, total_tax_amount.tax_rate)
        try:
            tax_rate = from_stripe_tax_rate(stripe_tax_rate)
        except ValueError:
            continue
        else:
            break

    return {
        "order": order,
        "tax_rate": tax_rate,
        "taxability_reason": taxability_reason,
        "tax_id": tax_id,
    }


@cli.command()
@typer_async
async def tax_rates_import(stripe_api_key: str) -> None:
    stripe_lib.api_key = stripe_api_key
    stripe_lib.api_version = "2025-02-24.acacia"
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = (
            select(Order)
            .where(Order.stripe_invoice_id.isnot(None))
            .order_by(Order.created_at.asc())
        )
        results = await session.stream_scalars(statement)

        with Progress() as progress:
            tasks: list[Task[MigratedOrder]] = []
            async with asyncio.TaskGroup() as tg:
                task_progress = progress.add_task(
                    "[red]Processing orders...", total=None
                )
                async for order in results:
                    order_id = order.id
                    stripe_invoice_id = order.stripe_invoice_id
                    assert stripe_invoice_id is not None
                    task = tg.create_task(migrate_order(order))
                    task.add_done_callback(
                        lambda t: progress.update(task_progress, advance=1)
                    )
                    tasks.append(task)
                progress.update(task_progress, total=len(tasks))
                progress.start_task(task_progress)

            progress.stop_task(task_progress)
            update_progress = progress.add_task(
                "[green]Updating orders...", total=len(tasks)
            )
            progress.start_task(update_progress)
            for task in tasks:
                migrated_order = task.result()
                order = migrated_order["order"]
                order.tax_rate = migrated_order["tax_rate"]
                order.taxability_reason = migrated_order["taxability_reason"]
                order.tax_id = migrated_order["tax_id"]
                session.add(order)
                progress.update(update_progress, advance=1)

        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    cli()

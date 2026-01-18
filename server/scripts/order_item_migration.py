import asyncio
import logging.config
import random
from functools import wraps
from typing import Any
from uuid import UUID

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Order, OrderItem, ProductPrice
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


def typer_async(f):
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


semaphore = asyncio.Semaphore(48)


async def process_order(
    order: Order, price_map: dict[str, UUID], retry: int = 1
) -> tuple[Order, list[OrderItem]]:
    assert order.stripe_invoice_id is not None
    try:
        async with semaphore:
            stripe_invoice = await stripe_lib.Invoice.retrieve_async(
                order.stripe_invoice_id
            )
    except stripe_lib.RateLimitError:
        await asyncio.sleep(retry + random.random())
        return await process_order(order, price_map, retry=retry + 1)

    items: list[OrderItem] = []
    for line_item in stripe_invoice.lines.data:
        tax_amount = sum([tax.amount for tax in line_item.tax_amounts])
        product_price_id: UUID | None = None
        price = line_item.price
        if price is not None:
            if price.metadata and price.metadata.get("product_price_id"):
                product_price_id = UUID(price.metadata["product_price_id"])
            else:
                product_price_id = price_map.get(price.id)

        items.append(
            OrderItem(
                order_id=order.id,
                created_at=order.created_at,
                label=line_item.description or "",
                amount=line_item.amount,
                tax_amount=tax_amount,
                proration=line_item.proration,
                product_price_id=product_price_id,
            )
        )

    discount_amount = 0
    if stripe_invoice.total_discount_amounts:
        for stripe_discount_amount in stripe_invoice.total_discount_amounts:
            discount_amount += stripe_discount_amount.amount
    order.discount_amount = discount_amount
    order.subtotal_amount = stripe_invoice.subtotal

    assert order.subtotal_amount == sum([item.amount for item in items])
    assert order.total_amount == stripe_invoice.total

    return order, items


@cli.command()
@typer_async
async def pledge_invoice_payment_fix(
    stripe_api_key: str,
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # Build price map
        price_map_statement = select(
            ProductPrice.__table__.c["stripe_price_id"], ProductPrice.id
        )
        price_map_results = await session.stream(price_map_statement)
        price_map: dict[str, UUID] = {}
        async for r in price_map_results:
            (
                stripe_price_id,
                product_price_id,
            ) = r._tuple()
            assert stripe_price_id is not None
            price_map[stripe_price_id] = product_price_id
        typer.echo(f"Price map built with {len(price_map)} entries")

        # Get orders to migrate
        orders_statement = select(Order).where(
            Order.id.in_(
                select(Order.id)
                .join(OrderItem, isouter=True)
                .where(Order.stripe_invoice_id.is_not(None))
                .group_by(Order.id)
                .having(func.count(OrderItem.id) == 0)
            )
        )
        results = await session.stream(orders_statement)
        typer.echo("Loaded orders to process")

        tasks = []
        with Progress() as progress:
            async with asyncio.TaskGroup() as tg:
                progress_task = progress.add_task(
                    "[red]Processing orders...", total=None
                )
                async for order in results.scalars():
                    task = tg.create_task(process_order(order, price_map))
                    task.add_done_callback(
                        lambda _: progress.update(progress_task, advance=1)
                    )
                    tasks.append(task)
                progress.update(progress_task, total=len(tasks))
                progress.start_task(progress_task)

        items_count = 0
        for task in tasks:
            order, items = task.result()
            session.add(order)
            session.add_all(items)
            items_count += len(items)

        typer.echo(f"Added {items_count} items to the session")

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

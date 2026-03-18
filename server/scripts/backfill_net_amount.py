import asyncio
from functools import wraps

import typer
from sqlalchemy import BigInteger, Case, Integer, func, select, update

from polar.models import (
    Checkout,
    Discount,
    Order,
    OrderItem,
    Subscription,
)
from polar.models.discount import DiscountFixed, DiscountPercentage, DiscountType
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


async def backfill_orders(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill net_amount for orders."""
    await run_batched_update(
        (
            update(Order)
            .values(_net_amount=Order.subtotal_amount - Order.discount_amount)
            .where(
                Order.id.in_(
                    select(Order.id)
                    .where(Order._net_amount.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_order_items(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill net_amount for order items."""
    await run_batched_update(
        (
            update(OrderItem)
            .values(net_amount=OrderItem.amount)
            .where(
                OrderItem.id.in_(
                    select(OrderItem.id)
                    .where(OrderItem.net_amount.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_checkouts(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill net_amount for checkouts."""
    # Need to compute discount amount by joining to discounts table
    discount_subquery = (
        select(
            Checkout.id.label("checkout_id"),
            func.coalesce(
                Case(
                    (
                        Checkout.discount_id.is_(None),
                        0,
                    ),
                    (
                        Discount.type == DiscountType.percentage,
                        func.cast(
                            func.round(
                                func.cast(Checkout.amount, BigInteger)
                                * DiscountPercentage.basis_points
                                / 10000.0
                            ),
                            Integer,
                        ),
                    ),
                    (
                        Discount.type == DiscountType.fixed,
                        func.least(
                            func.cast(
                                DiscountFixed.amounts[Checkout.currency].as_string(),
                                Integer,
                            ),
                            Checkout.amount,
                        ),
                    ),
                    else_=0,
                ),
                0,
            ).label("discount_amount"),
        )
        .outerjoin(Discount, Checkout.discount_id == Discount.id)
        .subquery()
    )

    await run_batched_update(
        (
            update(Checkout)
            .values(
                _net_amount=Checkout.amount - discount_subquery.c.discount_amount,
            )
            .where(
                Checkout.id == discount_subquery.c.checkout_id,
                Checkout.id.in_(
                    select(Checkout.id)
                    .where(Checkout._net_amount.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_subscriptions(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill net_amount for subscriptions."""
    await run_batched_update(
        (
            update(Subscription)
            .values(_net_amount=Subscription.amount)
            .where(
                Subscription.id.in_(
                    select(Subscription.id)
                    .where(Subscription._net_amount.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


@cli.command()
@typer_async
async def backfill_all(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Backfill net_amount for all tables in order: orders -> order_items -> checkouts -> subscriptions."""
    print("Backfilling orders...")
    await backfill_orders(batch_size, sleep_seconds)

    print("Backfilling order items...")
    await backfill_order_items(batch_size, sleep_seconds)

    print("Backfilling checkouts...")
    await backfill_checkouts(batch_size, sleep_seconds)

    print("Backfilling subscriptions...")
    await backfill_subscriptions(batch_size, sleep_seconds)

    print("All backfills completed!")


if __name__ == "__main__":
    cli()

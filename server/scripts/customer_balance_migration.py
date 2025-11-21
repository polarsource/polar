import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from rich import print
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Checkout, Customer, Order, Payment, Wallet
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.wallet_transaction import WalletTransaction
from polar.postgres import create_async_engine
from polar.redis import create_redis

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
async def customer_balance_migration(dry_run: bool = True) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")

    async with sessionmaker() as session:
        # CTE 1: Aggregate order totals by customer
        order_totals = (
            select(
                Order.customer_id.label("customer_id"),
                func.coalesce(
                    func.sum(
                        case(
                            (Order.total_amount >= 0, Order.total_amount),
                            else_=0,
                        )
                    ),
                    0,
                ).label("positive_order_total"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Order.total_amount >= 0,
                                Order.refunded_amount + Order.refunded_tax_amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("refunds"),
                func.coalesce(
                    func.sum(
                        case(
                            (Order.total_amount < 0, func.abs(Order.total_amount)),
                            else_=0,
                        )
                    ),
                    0,
                ).label("negative_order_total"),
                func.coalesce(
                    func.sum(Order.applied_balance_amount),
                    0,
                ).label("applied_balance"),
            )
            .select_from(Order)
            .where(
                Order.deleted_at.is_(None),
                Order.status.in_(
                    [
                        OrderStatus.paid,
                        OrderStatus.partially_refunded,
                        OrderStatus.refunded,
                    ]
                ),
                Order.user_metadata["donation_id"].is_(None),
            )
            .group_by(Order.customer_id)
        ).cte("order_totals")

        # CTE 2: Aggregate payment totals by customer
        # Get customer_id from either orders or checkouts
        payment_totals = (
            select(
                func.coalesce(Order.customer_id, Checkout.customer_id).label(
                    "customer_id"
                ),
                func.sum(Payment.amount).label("total_paid"),
            )
            .select_from(Payment)
            .outerjoin(Order, Payment.order_id == Order.id)
            .outerjoin(Checkout, Payment.checkout_id == Checkout.id)
            .where(
                Payment.status == PaymentStatus.succeeded,
                or_(
                    and_(
                        Order.customer_id.is_not(None),
                        Order.deleted_at.is_(None),
                        Order.status.in_(
                            [
                                OrderStatus.paid,
                                OrderStatus.partially_refunded,
                                OrderStatus.refunded,
                            ]
                        ),
                    ),
                    and_(
                        Checkout.customer_id.is_not(None),
                        Checkout.deleted_at.is_(None),
                    ),
                ),
            )
            .group_by(func.coalesce(Order.customer_id, Checkout.customer_id))
        ).cte("payment_totals")

        # Main query: Join CTEs and calculate balance
        # Logic: Refunds offset negative orders first
        # 1. settled_amount = min(refunds, negative_orders)
        # 2. remaining_refunds = refunds - settled_amount
        # 3. remaining_negative = negative_orders - settled_amount
        # 4. balance = (payments + applied_balance) - positive_orders + remaining_negative
        # 5. If balance < 0, apply remaining_refunds but cap at 0</parameter>
        balance_query = (
            select(
                Customer.id.label("customer_id"),
                case(
                    (
                        # When balance before remaining_refunds is negative
                        (
                            func.coalesce(payment_totals.c.total_paid, 0)
                            + func.coalesce(order_totals.c.applied_balance, 0)
                            - order_totals.c.positive_order_total
                            + func.greatest(
                                order_totals.c.negative_order_total
                                - order_totals.c.refunds,
                                0,
                            )
                        )
                        < 0,
                        # Apply remaining refunds but cap at 0
                        func.least(
                            func.coalesce(payment_totals.c.total_paid, 0)
                            + func.coalesce(order_totals.c.applied_balance, 0)
                            - order_totals.c.positive_order_total
                            + func.greatest(
                                order_totals.c.negative_order_total
                                - order_totals.c.refunds,
                                0,
                            )
                            + func.greatest(
                                order_totals.c.refunds
                                - order_totals.c.negative_order_total,
                                0,
                            ),
                            0,
                        ),
                    ),
                    else_=(
                        func.coalesce(payment_totals.c.total_paid, 0)
                        + func.coalesce(order_totals.c.applied_balance, 0)
                        - order_totals.c.positive_order_total
                        + func.greatest(
                            order_totals.c.negative_order_total
                            - order_totals.c.refunds,
                            0,
                        )
                    ),
                ).label("balance"),
            )
            .select_from(Customer)
            .outerjoin(order_totals, Customer.id == order_totals.c.customer_id)
            .outerjoin(payment_totals, Customer.id == payment_totals.c.customer_id)
            .where(
                Customer.deleted_at.is_(None),
                # Filter for non-zero balances (same logic as above)
                case(
                    (
                        (
                            func.coalesce(payment_totals.c.total_paid, 0)
                            + func.coalesce(order_totals.c.applied_balance, 0)
                            - order_totals.c.positive_order_total
                            + func.greatest(
                                order_totals.c.negative_order_total
                                - order_totals.c.refunds,
                                0,
                            )
                        )
                        < 0,
                        func.least(
                            func.coalesce(payment_totals.c.total_paid, 0)
                            + func.coalesce(order_totals.c.applied_balance, 0)
                            - order_totals.c.positive_order_total
                            + func.greatest(
                                order_totals.c.negative_order_total
                                - order_totals.c.refunds,
                                0,
                            )
                            + func.greatest(
                                order_totals.c.refunds
                                - order_totals.c.negative_order_total,
                                0,
                            ),
                            0,
                        ),
                    ),
                    else_=(
                        func.coalesce(payment_totals.c.total_paid, 0)
                        + func.coalesce(order_totals.c.applied_balance, 0)
                        - order_totals.c.positive_order_total
                        + func.greatest(
                            order_totals.c.negative_order_total
                            - order_totals.c.refunds,
                            0,
                        )
                    ),
                )
                != 0,
            )
        )

        print("[green]Calculating customer balances...")
        result = await session.execute(balance_query)
        customer_balances = {row.customer_id: row.balance for row in result}

        print(f"Found {len(customer_balances)} customers with non-zero balances")

        if customer_balances:
            print("[green]Inserting wallets...")
            await session.execute(
                insert(Wallet)
                .values(id=func.uuid_generate_v4(), created_at=func.now())
                .on_conflict_do_nothing(
                    index_elements=["customer_id", "type", "currency"]
                ),
                [
                    {
                        "type": "billing",
                        "currency": "usd",
                        "customer_id": customer_id,
                    }
                    for customer_id in customer_balances.keys()
                ],
            )

            print("[green]Inserting wallet transactions...")
            await session.execute(
                insert(WalletTransaction).values(
                    [
                        {
                            "id": func.uuid_generate_v4(),
                            "timestamp": func.now(),
                            "currency": "usd",
                            "amount": balance,
                            "wallet_id": select(Wallet.id)
                            .where(
                                Wallet.customer_id == customer_id,
                            )
                            .scalar_subquery(),
                        }
                        for customer_id, balance in customer_balances.items()
                    ]
                ),
            )

        if dry_run:
            print("[yellow]DRY RUN: Rolling back changes")
            await session.rollback()
        else:
            print("[green]Committing changes...")
            await session.commit()

        print(f"[green]Done! Processed {len(customer_balances)} customers")


if __name__ == "__main__":
    cli()

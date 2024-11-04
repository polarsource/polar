import asyncio
import logging.config
from functools import wraps
from typing import Any

import stripe as stripe_lib
import structlog
import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Transaction
from polar.models.transaction import TransactionType
from polar.order.service import order as order_service
from polar.postgres import create_async_engine

stripe_lib.api_key = settings.STRIPE_SECRET_KEY
stripe_http_client = stripe_lib.HTTPXClient(allow_sync_methods=True)
stripe_lib.default_http_client = stripe_http_client


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
async def order_balance_fix(
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_async_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )

            unbalanced_orders_statement = (
                select(Order)
                .where(
                    Order.id.not_in(
                        select(Transaction.order_id).where(
                            Transaction.type == TransactionType.payment,
                            Transaction.order_id.is_not(None),
                        )
                    )
                )
                .order_by(Order.created_at)
                .options(joinedload(Order.product), joinedload(Order.product_price))
            )
            unbalanced_orders = await session.stream_scalars(
                unbalanced_orders_statement
            )
            async for order in unbalanced_orders:
                typer.echo("\n---\n")
                typer.echo(
                    f"🔄 Handling Order {order.id} created on {order.created_at}"
                )

                if order.stripe_invoice_id is None:
                    typer.echo(
                        typer.style(
                            "\tOrder has no Stripe invoice. Skipping.", fg="red"
                        )
                    )
                    continue

                invoice = await stripe_lib.Invoice.retrieve_async(
                    order.stripe_invoice_id
                )
                charge_id = (
                    get_expandable_id(invoice.charge) if invoice.charge else None
                )
                # With Polar Checkout, we mark the order paid out-of-band,
                # so we need to retrieve the charge manually from metadata
                if charge_id is None:
                    invoice_metadata = invoice.metadata or {}
                    payment_intent_id = invoice_metadata.get("payment_intent_id")
                    if payment_intent_id is None:
                        typer.echo(
                            typer.style("\tOrder has no charge. Skipping.", fg="red")
                        )
                        continue

                    payment_intent = await stripe_lib.PaymentIntent.retrieve_async(
                        payment_intent_id
                    )
                    if payment_intent.latest_charge is None:
                        typer.echo(
                            typer.style("\tOrder has no charge. Skipping.", fg="red")
                        )
                        continue
                    charge_id = get_expandable_id(payment_intent.latest_charge)

                await order_service._create_order_balance(
                    session, order, charge_id=get_expandable_id(charge_id)
                )
                session.add(order)
                typer.echo(
                    typer.style(
                        f"\tOrder balance created for Order {order.id}", fg="green"
                    )
                )

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


if __name__ == "__main__":
    cli()

import uuid

import structlog
import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.event.service import event as event_service
from polar.event.system import (
    BalanceCreditOrderMetadata,
    BalanceOrderMetadata,
    SystemEvent,
    build_system_event,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event, Order, Transaction
from polar.postgres import create_async_engine
from scripts.helper import typer_async

log = structlog.get_logger()
cli = typer.Typer()


@cli.command()
@typer_async
async def backfill(
    order_id: uuid.UUID,
    dry_run: bool = True,
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        order = await session.get(
            Order,
            order_id,
            options=[
                joinedload(Order.customer),
                joinedload(Order.organization),
            ],
        )
        if order is None:
            typer.echo(f"Order {order_id} not found")
            raise typer.Exit(1)

        typer.echo(f"Order: {order.id} ({order.billing_reason})")

        # Check if either event already exists
        existing = await session.scalar(
            select(Event.id).where(
                Event.source == "system",
                Event.customer_id == order.customer_id,
                Event.user_metadata["order_id"].astext == str(order.id),
                Event.name.in_(["balance.order", "balance.credit_order"]),
            )
        )
        if existing is not None:
            typer.echo("  Event already exists, nothing to do.")
            raise typer.Exit(0)

        # Determine which event to create based on whether a payment exists
        txn = await session.scalar(
            select(Transaction).where(
                Transaction.order_id == order.id,
                Transaction.type == "payment",
            )
        )

        # If there's a payment, check that balance transactions exist
        # (if not, the order is still held and shouldn't get an event yet)
        if txn is not None:
            has_balance_txn = await session.scalar(
                select(Transaction.id).where(
                    Transaction.order_id == order.id,
                    Transaction.type == "balance",
                )
            )
            if has_balance_txn is None:
                typer.echo(
                    "  Order has payment but no balance transactions — still held, skipping."
                )
                raise typer.Exit(0)

        organization = order.organization

        if txn is not None:
            assert txn.presentment_amount is not None
            assert txn.presentment_currency is not None

            metadata: BalanceOrderMetadata = {
                "transaction_id": str(txn.id),
                "order_id": str(order.id),
                "amount": txn.amount,
                "net_amount": order.net_amount,
                "currency": txn.currency,
                "presentment_amount": txn.presentment_amount,
                "presentment_currency": txn.presentment_currency,
                "tax_amount": order.tax_amount,
                "fee": order.platform_fee_amount,
            }
            if order.tax_breakdown:
                if order.tax_breakdown[0]["country"] is not None:
                    metadata["tax_country"] = order.tax_breakdown[0]["country"]
                if order.tax_breakdown[0]["state"] is not None:
                    metadata["tax_state"] = order.tax_breakdown[0]["state"]
            if order.subscription_id is not None:
                metadata["subscription_id"] = str(order.subscription_id)
            if order.product_id is not None:
                metadata["product_id"] = str(order.product_id)
            if txn.exchange_rate is not None:
                metadata["exchange_rate"] = txn.exchange_rate

            event_name = "balance.order"
            typer.echo(f"  Event: {event_name}")
            typer.echo(f"  Amount: {txn.amount} {txn.currency}")
            typer.echo(f"  Net: {order.net_amount}")
            typer.echo(f"  Fee: {order.platform_fee_amount}")

            if not dry_run:
                event = build_system_event(
                    SystemEvent.balance_order,
                    customer=order.customer,
                    organization=organization,
                    metadata=metadata,
                )
                event.timestamp = order.created_at
                await event_service.create_event(session, event)
        else:
            credit_metadata: BalanceCreditOrderMetadata = {
                "order_id": str(order.id),
                "amount": order.net_amount,
                "currency": order.currency,
                "tax_amount": order.tax_amount,
                "fee": order.platform_fee_amount,
            }
            if order.tax_breakdown:
                if order.tax_breakdown[0]["country"] is not None:
                    credit_metadata["tax_country"] = order.tax_breakdown[0]["country"]
                if order.tax_breakdown[0]["state"] is not None:
                    credit_metadata["tax_state"] = order.tax_breakdown[0]["state"]
            if order.subscription_id is not None:
                credit_metadata["subscription_id"] = str(order.subscription_id)
            if order.product_id is not None:
                credit_metadata["product_id"] = str(order.product_id)

            event_name = "balance.credit_order"
            typer.echo(f"  Event: {event_name}")
            typer.echo(f"  Amount: {order.net_amount} {order.currency}")
            typer.echo(f"  Fee: {order.platform_fee_amount}")

            if not dry_run:
                event = build_system_event(
                    SystemEvent.balance_credit_order,
                    customer=order.customer,
                    organization=organization,
                    metadata=credit_metadata,
                )
                event.timestamp = order.created_at
                await event_service.create_event(session, event)

        if dry_run:
            typer.echo(
                f"\nDry run — would create {event_name}. Pass --no-dry-run to create."
            )
        else:
            await session.commit()
            typer.echo(f"\nCreated {event_name}")


if __name__ == "__main__":
    cli()

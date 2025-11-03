import asyncio
import logging.config
from collections.abc import Sequence
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import String, and_, func, or_, select
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import OrderPaidMetadata, OrderRefundedMetadata, SystemEvent
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Event, Order
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.refund import Refund, RefundStatus
from polar.postgres import create_async_engine

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def _build_events_for_orders(
    session: AsyncSession, orders: Sequence[Order]
) -> list[dict[str, Any]]:
    """Build events for a batch of orders using order and refund timestamps."""
    import uuid

    order_ids = [order.id for order in orders]
    orders_by_id = {order.id: order for order in orders}

    refunds_result = await session.execute(
        select(Refund)
        .where(
            Refund.order_id.in_(order_ids),
            Refund.status == RefundStatus.succeeded,
        )
        .order_by(Refund.created_at.asc())
    )
    refunds = refunds_result.scalars().all()

    refunds_by_order: dict[uuid.UUID, list[Refund]] = {}
    for refund in refunds:
        if refund.order_id is None:
            continue
        if refund.order_id not in refunds_by_order:
            refunds_by_order[refund.order_id] = []
        refunds_by_order[refund.order_id].append(refund)

    events: list[dict[str, Any]] = []
    for order_id, order in orders_by_id.items():
        events.append(
            {
                "name": SystemEvent.order_paid,
                "source": EventSource.system,
                "timestamp": order.created_at,
                "customer_id": order.customer_id,
                "organization_id": order.customer.organization_id,
                "user_metadata": OrderPaidMetadata(
                    order_id=str(order.id),
                    amount=order.total_amount,
                    currency=order.currency,
                    backfilled=True,
                ),
            }
        )

        order_refunds = refunds_by_order.get(order_id, [])
        for refund in order_refunds:
            events.append(
                {
                    "name": SystemEvent.order_refunded,
                    "source": EventSource.system,
                    "timestamp": refund.created_at,
                    "customer_id": order.customer_id,
                    "organization_id": order.customer.organization_id,
                    "user_metadata": OrderRefundedMetadata(
                        order_id=str(order.id),
                        refunded_amount=refund.amount,
                        currency=order.currency,
                        backfilled=True,
                    ),
                }
            )

    return events


async def backfill_order_events(
    batch_size: int = settings.DATABASE_STREAM_YIELD_PER,
    rate_limit_delay: float = 1.0,
    session: AsyncSession | None = None,
) -> None:
    """
    Backfill order.paid and order.refunded events for all existing orders.
    Uses order.created_at for paid events and refund.created_at for refund events.
    """
    engine = None
    own_session = False

    if session is None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    try:
        last_created_at = None
        last_id = None
        total_orders = 0
        total_events = 0

        existing_order_ids_subquery = (
            select(Event.user_metadata["order_id"].as_string().label("order_id"))
            .where(Event.name.in_([SystemEvent.order_paid, SystemEvent.order_refunded]))
            .distinct()
            .subquery()
        )

        count_statement = (
            select(func.count(Order.id))
            .outerjoin(
                existing_order_ids_subquery,
                existing_order_ids_subquery.c.order_id == Order.id.cast(String),
            )
            .where(
                Order.deleted_at.is_(None),
                existing_order_ids_subquery.c.order_id.is_(None),
                Order.status.in_(
                    [
                        OrderStatus.paid,
                        OrderStatus.refunded,
                        OrderStatus.partially_refunded,
                    ]
                ),
            )
        )
        count_result = await session.execute(count_statement)
        total_to_process = count_result.scalar() or 0

        if total_to_process == 0:
            typer.echo("No orders to backfill")
            return

        typer.echo(f"Found {total_to_process} orders to backfill")

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling order events...", total=total_to_process
            )

            while True:
                statement = (
                    select(Order)
                    .outerjoin(
                        existing_order_ids_subquery,
                        existing_order_ids_subquery.c.order_id == Order.id.cast(String),
                    )
                    .where(
                        Order.deleted_at.is_(None),
                        existing_order_ids_subquery.c.order_id.is_(None),
                        Order.status.in_(
                            [
                                OrderStatus.paid,
                                OrderStatus.refunded,
                                OrderStatus.partially_refunded,
                            ]
                        ),
                    )
                    .options(selectinload(Order.customer))
                    .order_by(Order.created_at.asc(), Order.id.asc())
                    .limit(batch_size)
                )

                if last_created_at is not None:
                    statement = statement.where(
                        or_(
                            Order.created_at > last_created_at,
                            and_(
                                Order.created_at == last_created_at, Order.id > last_id
                            ),
                        )
                    )

                result = await session.execute(statement)
                orders = result.scalars().all()
                if not orders:
                    break

                last_created_at = orders[-1].created_at
                last_id = orders[-1].id

                events = await _build_events_for_orders(session, orders)
                batch_orders_count = len(orders)
                total_orders += batch_orders_count

                if events:
                    await EventRepository.from_session(session).insert_batch(events)
                    await session.commit()
                    total_events += len(events)
                    await asyncio.sleep(rate_limit_delay)

                progress.update(task, advance=batch_orders_count)

        typer.echo("\n---\n")
        typer.echo(
            f"Successfully backfilled {total_events} events for {total_orders} orders"
        )
        typer.echo("\n---\n")
    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        settings.DATABASE_STREAM_YIELD_PER,
        help="Number of orders to process per batch",
    ),
    rate_limit_delay: float = typer.Option(
        1.0, help="Delay in seconds between batches"
    ),
) -> None:
    """
    Backfill order.paid and order.refunded events for all existing orders.

    Uses order.created_at for paid events and refund.created_at for refund events.
    This script processes orders in batches to avoid long-running transactions.
    """
    await backfill_order_events(
        batch_size=batch_size, rate_limit_delay=rate_limit_delay
    )


if __name__ == "__main__":
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )
    cli()

import asyncio
import logging.config
import uuid
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import (
    BalanceDisputeMetadata,
    BalanceOrderMetadata,
    BalanceRefundMetadata,
    SystemEvent,
)
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Customer, Dispute, Event, Order, Refund, Transaction
from polar.models.event import EventSource
from polar.models.refund import RefundStatus
from polar.models.transaction import PlatformFeeType, TransactionType

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def _compute_fees_by_order(session: AsyncSession) -> dict[str, int]:
    """
    Compute total platform fees for each order.

    Fees are stored as balance transactions with platform_fee_type set,
    where account_id is NULL (Polar's share).
    """
    fees_result = await session.execute(
        select(Transaction.order_id, func.sum(Transaction.amount))
        .where(
            Transaction.type == TransactionType.balance,
            Transaction.order_id.is_not(None),
            Transaction.platform_fee_type.is_not(None),
            Transaction.account_id.is_(None),
        )
        .group_by(Transaction.order_id)
    )
    return {str(row[0]): row[1] for row in fees_result.fetchall()}


async def _compute_dispute_fees_by_order(session: AsyncSession) -> dict[str, int]:
    """
    Compute dispute fees for each order.

    Dispute fees are balance transactions with platform_fee_type='dispute',
    where account_id is NULL (Polar's share).
    """
    fees_result = await session.execute(
        select(Transaction.order_id, func.sum(Transaction.amount))
        .where(
            Transaction.type == TransactionType.balance,
            Transaction.order_id.is_not(None),
            Transaction.platform_fee_type == PlatformFeeType.dispute,
            Transaction.account_id.is_(None),
        )
        .group_by(Transaction.order_id)
    )
    return {str(row[0]): row[1] for row in fees_result.fetchall()}


async def create_missing_balance_order_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.order events for payment transactions that don't have one.
    """
    typer.echo("\n=== Creating missing balance.order events ===")

    typer.echo("Computing fees by order...")
    fees_by_order = await _compute_fees_by_order(session)
    typer.echo(f"Computed fees for {len(fees_by_order)} orders")

    existing_tx_ids_result = await session.execute(
        select(Event.user_metadata["transaction_id"].as_string())
        .where(
            Event.name == SystemEvent.balance_order,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_tx_ids = {row[0] for row in existing_tx_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_tx_ids)} existing balance.order events")

    all_tx_ids_result = await session.execute(
        select(Transaction.id).where(
            Transaction.type == TransactionType.payment,
            Transaction.order_id.is_not(None),
        )
    )
    all_tx_ids = [row[0] for row in all_tx_ids_result.fetchall()]

    missing_tx_ids = [
        tx_id for tx_id in all_tx_ids if str(tx_id) not in existing_tx_ids
    ]
    total_to_create = len(missing_tx_ids)

    if total_to_create == 0:
        typer.echo("No missing balance.order events to create")
        return 0

    typer.echo(
        f"Found {total_to_create} payment transactions without balance.order events"
    )

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating balance.order events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_tx_ids[i : i + batch_size]

            statement = (
                select(Transaction)
                .where(Transaction.id.in_(batch_ids))
                .options(
                    selectinload(Transaction.order).selectinload(Order.customer),
                    selectinload(Transaction.order).selectinload(Order.subscription),
                )
            )

            result = await session.execute(statement)
            transactions = result.scalars().all()

            if not transactions:
                break

            events = []
            for tx in transactions:
                if tx.order is None or tx.order.customer is None:
                    typer.echo(f"Warning: Transaction {tx.id} has no order or customer")
                    continue

                assert tx.presentment_amount is not None
                assert tx.presentment_currency is not None

                order_id_str = str(tx.order.id)
                metadata: BalanceOrderMetadata = {
                    "transaction_id": str(tx.id),
                    "order_id": order_id_str,
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "presentment_amount": tx.presentment_amount,
                    "presentment_currency": tx.presentment_currency,
                    "tax_amount": tx.order.tax_amount,
                    "fee": fees_by_order.get(order_id_str, 0),
                }
                if tx.order.tax_rate is not None:
                    if tx.order.tax_rate["country"] is not None:
                        metadata["tax_country"] = tx.order.tax_rate["country"]
                    if tx.order.tax_rate["state"] is not None:
                        metadata["tax_state"] = tx.order.tax_rate["state"]
                if tx.order.subscription_id is not None:
                    metadata["subscription_id"] = str(tx.order.subscription_id)
                if tx.order.product_id is not None:
                    metadata["product_id"] = str(tx.order.product_id)

                events.append(
                    {
                        "name": SystemEvent.balance_order,
                        "source": EventSource.system,
                        "timestamp": tx.created_at,
                        "customer_id": tx.order.customer.id,
                        "organization_id": tx.order.customer.organization_id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(transactions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.order events")
    return created_count


async def _compute_refundable_amounts(
    session: AsyncSession,
) -> dict[str, int]:
    """
    Compute the refundable amount remaining after each refund.

    Returns a dict mapping refund_id -> refundable_amount after that refund.
    """
    refundable_amounts: dict[str, int] = {}

    orders_with_refunds_result = await session.execute(
        select(Order.id, Order.total_amount).where(Order.refunded_amount > 0).distinct()
    )
    orders_with_refunds = {
        str(row[0]): row[1] for row in orders_with_refunds_result.fetchall()
    }

    if not orders_with_refunds:
        return refundable_amounts

    refunds_result = await session.execute(
        select(Refund.id, Refund.order_id, Refund.amount, Refund.tax_amount)
        .where(
            Refund.order_id.in_([uuid.UUID(oid) for oid in orders_with_refunds.keys()]),
            Refund.status == RefundStatus.succeeded,
        )
        .order_by(Refund.created_at.asc())
    )

    refunds_by_order: dict[str, list[tuple[str, int, int]]] = {}
    for row in refunds_result.fetchall():
        refund_id, order_id, amount, tax_amount = row
        order_id_str = str(order_id)
        if order_id_str not in refunds_by_order:
            refunds_by_order[order_id_str] = []
        refunds_by_order[order_id_str].append((str(refund_id), amount, tax_amount))

    for order_id_str, refunds in refunds_by_order.items():
        order_total = orders_with_refunds.get(order_id_str, 0)
        cumulative = 0
        for refund_id, amount, tax_amount in refunds:
            cumulative += amount + tax_amount
            refundable_amounts[refund_id] = max(0, order_total - cumulative)

    return refundable_amounts


async def create_missing_balance_refund_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.refund events for refund transactions that don't have one.
    """
    typer.echo("\n=== Creating missing balance.refund events ===")

    typer.echo("Computing refundable amounts for each refund...")
    refundable_amounts = await _compute_refundable_amounts(session)
    typer.echo(f"Computed refundable amounts for {len(refundable_amounts)} refunds")

    existing_tx_ids_result = await session.execute(
        select(Event.user_metadata["transaction_id"].as_string())
        .where(
            Event.name == SystemEvent.balance_refund,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_tx_ids = {row[0] for row in existing_tx_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_tx_ids)} existing balance.refund events")

    all_tx_ids_result = await session.execute(
        select(Transaction.id).where(
            Transaction.type == TransactionType.refund,
            Transaction.refund_id.is_not(None),
        )
    )
    all_tx_ids = [row[0] for row in all_tx_ids_result.fetchall()]

    missing_tx_ids = [
        tx_id for tx_id in all_tx_ids if str(tx_id) not in existing_tx_ids
    ]
    total_to_create = len(missing_tx_ids)

    if total_to_create == 0:
        typer.echo("No missing balance.refund events to create")
        return 0

    typer.echo(
        f"Found {total_to_create} refund transactions without balance.refund events"
    )

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating balance.refund events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_tx_ids[i : i + batch_size]

            statement = (
                select(Transaction)
                .where(Transaction.id.in_(batch_ids))
                .options(
                    selectinload(Transaction.refund).selectinload(Refund.customer),
                    selectinload(Transaction.refund).selectinload(Refund.organization),
                    selectinload(Transaction.refund).selectinload(Refund.order),
                )
            )

            result = await session.execute(statement)
            transactions = result.scalars().all()

            if not transactions:
                break

            events = []
            for tx in transactions:
                if tx.refund is None:
                    typer.echo(f"Warning: Transaction {tx.id} has no refund")
                    continue
                if tx.refund.customer is None or tx.refund.organization is None:
                    typer.echo(
                        f"Warning: Refund {tx.refund.id} has no customer or organization"
                    )
                    continue

                assert tx.presentment_amount is not None
                assert tx.presentment_currency is not None

                metadata: BalanceRefundMetadata = {
                    "transaction_id": str(tx.id),
                    "refund_id": str(tx.refund.id),
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "presentment_amount": tx.presentment_amount,
                    "presentment_currency": tx.presentment_currency,
                    "tax_amount": tx.tax_amount,
                    "tax_country": tx.tax_country or "",
                    "tax_state": tx.tax_state or "",
                    "fee": 0,
                }
                if tx.order_id is not None:
                    metadata["order_id"] = str(tx.order_id)
                if tx.refund.order is not None:
                    order = tx.refund.order
                    if order.product_id is not None:
                        metadata["product_id"] = str(order.product_id)
                refund_id_str = str(tx.refund.id)
                if refund_id_str in refundable_amounts:
                    metadata["refundable_amount"] = refundable_amounts[refund_id_str]
                if tx.refund.subscription_id is not None:
                    metadata["subscription_id"] = str(tx.refund.subscription_id)
                if tx.presentment_amount is not None:
                    metadata["presentment_amount"] = tx.presentment_amount
                if tx.presentment_currency is not None:
                    metadata["presentment_currency"] = tx.presentment_currency

                events.append(
                    {
                        "name": SystemEvent.balance_refund,
                        "source": EventSource.system,
                        "timestamp": tx.created_at,
                        "customer_id": tx.refund.customer.id,
                        "organization_id": tx.refund.organization.id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(transactions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.refund events")
    return created_count


async def create_missing_balance_dispute_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.dispute events for dispute transactions that don't have one.
    """
    typer.echo("\n=== Creating missing balance.dispute events ===")

    typer.echo("Computing dispute fees by order...")
    dispute_fees_by_order = await _compute_dispute_fees_by_order(session)
    typer.echo(f"Computed dispute fees for {len(dispute_fees_by_order)} orders")

    existing_tx_ids_result = await session.execute(
        select(Event.user_metadata["transaction_id"].as_string())
        .where(
            Event.name == SystemEvent.balance_dispute,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_tx_ids = {row[0] for row in existing_tx_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_tx_ids)} existing balance.dispute events")

    all_tx_ids_result = await session.execute(
        select(Transaction.id).where(
            Transaction.type == TransactionType.dispute,
            Transaction.dispute_id.is_not(None),
        )
    )
    all_tx_ids = [row[0] for row in all_tx_ids_result.fetchall()]

    missing_tx_ids = [
        tx_id for tx_id in all_tx_ids if str(tx_id) not in existing_tx_ids
    ]
    total_to_create = len(missing_tx_ids)

    if total_to_create == 0:
        typer.echo("No missing balance.dispute events to create")
        return 0

    typer.echo(
        f"Found {total_to_create} dispute transactions without balance.dispute events"
    )

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating balance.dispute events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_tx_ids[i : i + batch_size]

            statement = (
                select(Transaction)
                .where(Transaction.id.in_(batch_ids))
                .options(
                    selectinload(Transaction.dispute)
                    .selectinload(Dispute.order)
                    .selectinload(Order.customer)
                    .selectinload(Customer.organization),
                )
            )

            result = await session.execute(statement)
            transactions = result.scalars().all()

            if not transactions:
                break

            events = []
            for tx in transactions:
                if tx.dispute is None or tx.dispute.order is None:
                    typer.echo(f"Warning: Transaction {tx.id} has no dispute or order")
                    continue
                customer = tx.dispute.order.customer
                if customer is None or customer.organization is None:
                    typer.echo(
                        f"Warning: Transaction {tx.id} has no customer or organization"
                    )
                    continue

                assert tx.presentment_amount is not None
                assert tx.presentment_currency is not None

                order_id_str = str(tx.order_id) if tx.order_id else None
                metadata: BalanceDisputeMetadata = {
                    "transaction_id": str(tx.id),
                    "dispute_id": str(tx.dispute.id),
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "presentment_amount": tx.presentment_amount,
                    "presentment_currency": tx.presentment_currency,
                    "tax_amount": tx.tax_amount,
                    "tax_country": tx.tax_country or "",
                    "tax_state": tx.tax_state or "",
                    "fee": dispute_fees_by_order.get(order_id_str, 0)
                    if order_id_str
                    else 0,
                }
                if tx.order_id is not None:
                    metadata["order_id"] = str(tx.order_id)
                if tx.dispute.order is not None:
                    if tx.dispute.order.product_id is not None:
                        metadata["product_id"] = str(tx.dispute.order.product_id)
                    if tx.dispute.order.subscription_id is not None:
                        metadata["subscription_id"] = str(
                            tx.dispute.order.subscription_id
                        )

                events.append(
                    {
                        "name": SystemEvent.balance_dispute,
                        "source": EventSource.system,
                        "timestamp": tx.created_at,
                        "customer_id": customer.id,
                        "organization_id": customer.organization.id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(transactions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.dispute events")
    return created_count


async def create_missing_balance_dispute_reversal_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.dispute_reversal events for dispute_reversal transactions that don't have one.
    """
    typer.echo("\n=== Creating missing balance.dispute_reversal events ===")

    existing_tx_ids_result = await session.execute(
        select(Event.user_metadata["transaction_id"].as_string())
        .where(
            Event.name == SystemEvent.balance_dispute_reversal,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_tx_ids = {row[0] for row in existing_tx_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_tx_ids)} existing balance.dispute_reversal events")

    all_tx_ids_result = await session.execute(
        select(Transaction.id).where(
            Transaction.type == TransactionType.dispute_reversal,
            Transaction.dispute_id.is_not(None),
        )
    )
    all_tx_ids = [row[0] for row in all_tx_ids_result.fetchall()]

    missing_tx_ids = [
        tx_id for tx_id in all_tx_ids if str(tx_id) not in existing_tx_ids
    ]
    total_to_create = len(missing_tx_ids)

    if total_to_create == 0:
        typer.echo("No missing balance.dispute_reversal events to create")
        return 0

    typer.echo(
        f"Found {total_to_create} dispute_reversal transactions without balance.dispute_reversal events"
    )

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating balance.dispute_reversal events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_tx_ids[i : i + batch_size]

            statement = (
                select(Transaction)
                .where(Transaction.id.in_(batch_ids))
                .options(
                    selectinload(Transaction.dispute)
                    .selectinload(Dispute.order)
                    .selectinload(Order.customer)
                    .selectinload(Customer.organization),
                    selectinload(Transaction.incurred_transactions),
                )
            )

            result = await session.execute(statement)
            transactions = result.scalars().all()

            if not transactions:
                break

            events = []
            for tx in transactions:
                if tx.dispute is None or tx.dispute.order is None:
                    typer.echo(f"Warning: Transaction {tx.id} has no dispute or order")
                    continue
                customer = tx.dispute.order.customer
                if customer is None or customer.organization is None:
                    typer.echo(
                        f"Warning: Transaction {tx.id} has no customer or organization"
                    )
                    continue

                assert tx.presentment_amount is not None
                assert tx.presentment_currency is not None

                reversal_fee = sum(-fee.amount for fee in tx.incurred_transactions)

                metadata: BalanceDisputeMetadata = {
                    "transaction_id": str(tx.id),
                    "dispute_id": str(tx.dispute.id),
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "presentment_amount": tx.presentment_amount,
                    "presentment_currency": tx.presentment_currency,
                    "tax_amount": tx.tax_amount,
                    "tax_country": tx.tax_country or "",
                    "tax_state": tx.tax_state or "",
                    "fee": reversal_fee,
                }
                if tx.order_id is not None:
                    metadata["order_id"] = str(tx.order_id)
                if tx.dispute.order is not None:
                    if tx.dispute.order.product_id is not None:
                        metadata["product_id"] = str(tx.dispute.order.product_id)
                    if tx.dispute.order.subscription_id is not None:
                        metadata["subscription_id"] = str(
                            tx.dispute.order.subscription_id
                        )

                events.append(
                    {
                        "name": SystemEvent.balance_dispute_reversal,
                        "source": EventSource.system,
                        "timestamp": tx.created_at,
                        "customer_id": customer.id,
                        "organization_id": customer.organization.id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(transactions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.dispute_reversal events")
    return created_count


async def create_missing_balance_refund_reversal_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.refund_reversal events for refund_reversal transactions that don't have one.
    """
    typer.echo("\n=== Creating missing balance.refund_reversal events ===")

    existing_tx_ids_result = await session.execute(
        select(Event.user_metadata["transaction_id"].as_string())
        .where(
            Event.name == SystemEvent.balance_refund_reversal,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_tx_ids = {row[0] for row in existing_tx_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_tx_ids)} existing balance.refund_reversal events")

    all_tx_ids_result = await session.execute(
        select(Transaction.id).where(
            Transaction.type == TransactionType.refund_reversal,
            Transaction.refund_id.is_not(None),
        )
    )
    all_tx_ids = [row[0] for row in all_tx_ids_result.fetchall()]

    missing_tx_ids = [
        tx_id for tx_id in all_tx_ids if str(tx_id) not in existing_tx_ids
    ]
    total_to_create = len(missing_tx_ids)

    if total_to_create == 0:
        typer.echo("No missing balance.refund_reversal events to create")
        return 0

    typer.echo(
        f"Found {total_to_create} refund_reversal transactions without balance.refund_reversal events"
    )

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating balance.refund_reversal events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_tx_ids[i : i + batch_size]

            statement = (
                select(Transaction)
                .where(Transaction.id.in_(batch_ids))
                .options(
                    selectinload(Transaction.refund).selectinload(Refund.customer),
                    selectinload(Transaction.refund).selectinload(Refund.organization),
                    selectinload(Transaction.refund).selectinload(Refund.order),
                )
            )

            result = await session.execute(statement)
            transactions = result.scalars().all()

            if not transactions:
                break

            events = []
            for tx in transactions:
                if tx.refund is None:
                    typer.echo(f"Warning: Transaction {tx.id} has no refund")
                    continue
                if tx.refund.customer is None or tx.refund.organization is None:
                    typer.echo(
                        f"Warning: Refund {tx.refund.id} has no customer or organization"
                    )
                    continue

                assert tx.presentment_amount is not None
                assert tx.presentment_currency is not None

                metadata: BalanceRefundMetadata = {
                    "transaction_id": str(tx.id),
                    "refund_id": str(tx.refund.id),
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "presentment_amount": tx.presentment_amount,
                    "presentment_currency": tx.presentment_currency,
                    "tax_amount": tx.tax_amount,
                    "tax_country": tx.tax_country or "",
                    "tax_state": tx.tax_state or "",
                    "fee": 0,
                }
                if tx.order_id is not None:
                    metadata["order_id"] = str(tx.order_id)
                if tx.refund.order is not None:
                    order = tx.refund.order
                    if order.product_id is not None:
                        metadata["product_id"] = str(order.product_id)
                if tx.refund.subscription_id is not None:
                    metadata["subscription_id"] = str(tx.refund.subscription_id)

                events.append(
                    {
                        "name": SystemEvent.balance_refund_reversal,
                        "source": EventSource.system,
                        "timestamp": tx.created_at,
                        "customer_id": tx.refund.customer.id,
                        "organization_id": tx.refund.organization.id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(transactions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.refund_reversal events")
    return created_count


async def run_backfill(
    batch_size: int = settings.DATABASE_STREAM_YIELD_PER,
    rate_limit_delay: float = 0.5,
    session: AsyncSession | None = None,
) -> dict[str, int]:
    """
    Run all backfill operations for balance events.
    """
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    results: dict[str, int] = {}

    try:
        results["balance_order_created"] = await create_missing_balance_order_events(
            session, batch_size, rate_limit_delay
        )

        results["balance_refund_created"] = await create_missing_balance_refund_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "balance_dispute_created"
        ] = await create_missing_balance_dispute_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "balance_dispute_reversal_created"
        ] = await create_missing_balance_dispute_reversal_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "balance_refund_reversal_created"
        ] = await create_missing_balance_refund_reversal_events(
            session, batch_size, rate_limit_delay
        )

        typer.echo("\n" + "=" * 50)
        typer.echo("BALANCE EVENTS BACKFILL SUMMARY")
        typer.echo("=" * 50)
        for key, value in results.items():
            typer.echo(f"  {key}: {value}")
        typer.echo("=" * 50 + "\n")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()

    return results


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        settings.DATABASE_STREAM_YIELD_PER,
        help="Number of records to process per batch",
    ),
    rate_limit_delay: float = typer.Option(
        0.5, help="Delay in seconds between batches"
    ),
) -> None:
    """
    Backfill balance events for existing transactions.

    This script creates:
    1. balance.order events for payment transactions
    2. balance.refund events for refund transactions
    3. balance.dispute events for dispute transactions
    4. balance.dispute_reversal events for dispute_reversal transactions
    5. balance.refund_reversal events for refund_reversal transactions
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
            "handlers": {
                "default": {
                    "level": "DEBUG",
                    "class": "logging.StreamHandler",
                },
            },
            "root": {
                "handlers": ["default"],
                "level": "WARNING",
            },
        }
    )
    structlog.configure(
        processors=[drop_all],
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    await run_backfill(batch_size=batch_size, rate_limit_delay=rate_limit_delay)


if __name__ == "__main__":
    cli()

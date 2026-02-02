import asyncio
import logging.config
import uuid
from functools import wraps
from typing import Any, cast

import structlog
import typer
from sqlalchemy import func, literal, select, text, tuple_
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import (
    BalanceCreditOrderMetadata,
    BalanceDisputeMetadata,
    BalanceOrderMetadata,
    BalanceRefundMetadata,
    SystemEvent,
)
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Customer, Dispute, Event, Order, Refund, Transaction
from polar.models.event import EventSource
from polar.models.held_balance import HeldBalance
from polar.models.order import OrderStatus
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


async def fix_balance_order_timestamps(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Fix balance.order event timestamps to match order.created_at."""
    typer.echo("\n=== Fixing balance.order timestamps ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET timestamp = o.created_at
                FROM orders o
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN orders o2 ON (e2.user_metadata->>'order_id')::uuid = o2.id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.order'
                      AND e2.timestamp != o2.created_at
                    LIMIT :batch_size
                )
                AND (e.user_metadata->>'order_id')::uuid = o.id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(f"  Fixed {count} timestamps (total: {total_fixed})...")

    typer.echo(f"Fixed {total_fixed} timestamps")
    return total_fixed


async def fix_balance_order_fees(session: AsyncSession, batch_size: int = 1000) -> int:
    """Fix balance.order event fees to match order.platform_fee_amount."""
    typer.echo("\n=== Fixing balance.order fees ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{fee}',
                    to_jsonb(o.platform_fee_amount)
                )
                FROM orders o
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN orders o2 ON (e2.user_metadata->>'order_id')::uuid = o2.id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.order'
                      AND o2.platform_fee_amount != COALESCE((e2.user_metadata->>'fee')::numeric::int, 0)
                    LIMIT :batch_size
                )
                AND (e.user_metadata->>'order_id')::uuid = o.id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(f"  Fixed {count} fees (total: {total_fixed})...")

    typer.echo(f"Fixed {total_fixed} fees")
    return total_fixed


async def fix_refund_subscription_id(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Add subscription_id to balance.refund events missing it."""
    typer.echo("\n=== Adding subscription_id to refund events ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{subscription_id}',
                    to_jsonb(o.subscription_id::text)
                )
                FROM orders o
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN orders o2 ON (e2.user_metadata->>'order_id')::uuid = o2.id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.refund'
                      AND NOT e2.user_metadata ? 'subscription_id'
                      AND o2.subscription_id IS NOT NULL
                    LIMIT :batch_size
                )
                AND (e.user_metadata->>'order_id')::uuid = o.id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(
            f"  Added subscription_id to {count} events (total: {total_fixed})..."
        )

    typer.echo(f"Added subscription_id to {total_fixed} events")
    return total_fixed


async def fix_refund_order_created_at(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Add order_created_at to balance.refund events missing it."""
    typer.echo("\n=== Adding order_created_at to refund events ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{order_created_at}',
                    to_jsonb(o.created_at)
                )
                FROM orders o
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN orders o2 ON (e2.user_metadata->>'order_id')::uuid = o2.id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.refund'
                      AND NOT e2.user_metadata ? 'order_created_at'
                    LIMIT :batch_size
                )
                AND (e.user_metadata->>'order_id')::uuid = o.id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(
            f"  Added order_created_at to {count} events (total: {total_fixed})..."
        )

    typer.echo(f"Added order_created_at to {total_fixed} refund events")
    return total_fixed


async def fix_dispute_order_created_at(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Add order_created_at to balance.dispute events missing it."""
    typer.echo("\n=== Adding order_created_at to dispute events ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{order_created_at}',
                    to_jsonb(o.created_at)
                )
                FROM orders o, disputes d
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN disputes d2 ON d2.id = (e2.user_metadata->>'dispute_id')::uuid
                    JOIN orders o2 ON o2.id = d2.order_id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.dispute'
                      AND NOT e2.user_metadata ? 'order_created_at'
                    LIMIT :batch_size
                )
                AND d.id = (e.user_metadata->>'dispute_id')::uuid
                AND o.id = d.order_id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(
            f"  Added order_created_at to {count} events (total: {total_fixed})..."
        )

    typer.echo(f"Added order_created_at to {total_fixed} dispute events")
    return total_fixed


async def fix_dispute_reversal_order_created_at(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Add order_created_at to balance.dispute_reversal events missing it."""
    typer.echo("\n=== Adding order_created_at to dispute_reversal events ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{order_created_at}',
                    to_jsonb(o.created_at)
                )
                FROM orders o, disputes d
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN disputes d2 ON d2.id = (e2.user_metadata->>'dispute_id')::uuid
                    JOIN orders o2 ON o2.id = d2.order_id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.dispute_reversal'
                      AND NOT e2.user_metadata ? 'order_created_at'
                    LIMIT :batch_size
                )
                AND d.id = (e.user_metadata->>'dispute_id')::uuid
                AND o.id = d.order_id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(
            f"  Added order_created_at to {count} events (total: {total_fixed})..."
        )

    typer.echo(f"Added order_created_at to {total_fixed} dispute_reversal events")
    return total_fixed


async def fix_refund_reversal_order_created_at(
    session: AsyncSession, batch_size: int = 1000
) -> int:
    """Add order_created_at to balance.refund_reversal events missing it."""
    typer.echo("\n=== Adding order_created_at to refund_reversal events ===")

    total_fixed = 0
    while True:
        result = await session.execute(
            text("""
                UPDATE events e
                SET user_metadata = jsonb_set(
                    e.user_metadata,
                    '{order_created_at}',
                    to_jsonb(o.created_at)
                )
                FROM orders o, refunds r
                WHERE e.id IN (
                    SELECT e2.id
                    FROM events e2
                    JOIN refunds r2 ON r2.id = (e2.user_metadata->>'refund_id')::uuid
                    JOIN orders o2 ON o2.id = r2.order_id
                    WHERE e2.source = 'system'
                      AND e2.name = 'balance.refund_reversal'
                      AND NOT e2.user_metadata ? 'order_created_at'
                    LIMIT :batch_size
                )
                AND r.id = (e.user_metadata->>'refund_id')::uuid
                AND o.id = r.order_id
            """),
            {"batch_size": batch_size},
        )
        await session.commit()

        count = cast(CursorResult[Any], result).rowcount
        if count == 0:
            break
        total_fixed += count
        typer.echo(
            f"  Added order_created_at to {count} events (total: {total_fixed})..."
        )

    typer.echo(f"Added order_created_at to {total_fixed} refund_reversal events")
    return total_fixed


async def delete_duplicate_balance_order_events(session: AsyncSession) -> int:
    """Delete duplicate balance.order events, keeping only the oldest per order."""
    typer.echo("\n=== Deleting duplicate balance.order events ===")

    result = await session.execute(
        text("""
            DELETE FROM events WHERE id IN (
                SELECT id FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY user_metadata->>'order_id'
                            ORDER BY ingested_at ASC
                        ) as rn
                    FROM events
                    WHERE source = 'system'
                      AND name = 'balance.order'
                ) ranked
                WHERE rn > 1
            )
        """)
    )
    await session.commit()

    total_deleted = cast(CursorResult[Any], result).rowcount
    typer.echo(f"Deleted {total_deleted} duplicate events")
    return total_deleted


async def create_missing_balance_order_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.order events for payment transactions that don't have one.
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.order events ===")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing payment transactions...")

    while True:
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.payment,
                Transaction.order_id.is_not(None),
                Transaction.order_id.not_in(
                    select(HeldBalance.order_id).where(
                        HeldBalance.deleted_at.is_(None),
                        HeldBalance.order_id.is_not(None),
                    )
                ),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .options(
                selectinload(Transaction.order).selectinload(Order.customer),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Transaction.created_at, Transaction.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        transactions = batch_result.scalars().all()

        if not transactions:
            break

        batch_tx_ids = [str(tx.id) for tx in transactions]
        existing_result = await session.execute(
            select(Event.user_metadata["transaction_id"].as_string()).where(
                Event.name == SystemEvent.balance_order,
                Event.source == EventSource.system,
                Event.user_metadata["transaction_id"].as_string().in_(batch_tx_ids),
            )
        )
        existing_tx_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for tx in transactions:
            if str(tx.id) in existing_tx_ids:
                continue

            if tx.order is None or tx.order.customer is None:
                continue

            if tx.presentment_amount is None or tx.presentment_currency is None:
                continue

            metadata: BalanceOrderMetadata = {
                "transaction_id": str(tx.id),
                "order_id": str(tx.order.id),
                "amount": tx.amount,
                "currency": tx.currency,
                "presentment_amount": tx.presentment_amount,
                "presentment_currency": tx.presentment_currency,
                "tax_amount": tx.order.tax_amount,
                "fee": tx.order.platform_fee_amount,
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
                    "timestamp": tx.order.created_at,
                    "customer_id": tx.order.customer.id,
                    "organization_id": tx.order.customer.organization_id,
                    "user_metadata": metadata,
                }
            )

        if events:
            await EventRepository.from_session(session).insert_batch(events)
            await session.commit()
            created_count += len(events)

        last_created_at, last_id = transactions[-1].created_at, transactions[-1].id
        processed_count += len(transactions)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} transactions...")
        await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.order events")
    return created_count


async def create_missing_balance_credit_order_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create balance.credit_order events for orders paid via customer balance (no payment transaction).
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.credit_order events ===")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing credit orders (paid by balance)...")

    while True:
        query = (
            select(Order)
            .where(
                Order.status.in_(
                    [
                        OrderStatus.paid,
                        OrderStatus.refunded,
                        OrderStatus.partially_refunded,
                    ]
                ),
                ~Order.id.in_(
                    select(Transaction.order_id).where(
                        Transaction.type == TransactionType.payment,
                        Transaction.order_id.is_not(None),
                    )
                ),
            )
            .order_by(Order.created_at, Order.id)
            .limit(batch_size)
            .options(
                selectinload(Order.customer),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Order.created_at, Order.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        orders = batch_result.scalars().all()

        if not orders:
            break

        batch_order_ids = [str(o.id) for o in orders]
        existing_result = await session.execute(
            select(Event.user_metadata["order_id"].as_string()).where(
                Event.name == SystemEvent.balance_credit_order,
                Event.source == EventSource.system,
                Event.user_metadata["order_id"].as_string().in_(batch_order_ids),
            )
        )
        existing_order_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for order in orders:
            if str(order.id) in existing_order_ids:
                continue

            if order.customer is None:
                continue

            metadata: BalanceCreditOrderMetadata = {
                "order_id": str(order.id),
                "amount": order.net_amount,
                "currency": order.currency,
                "tax_amount": order.tax_amount,
                "fee": order.platform_fee_amount,
            }
            if order.tax_rate is not None:
                if order.tax_rate["country"] is not None:
                    metadata["tax_country"] = order.tax_rate["country"]
                if order.tax_rate["state"] is not None:
                    metadata["tax_state"] = order.tax_rate["state"]
            if order.subscription_id is not None:
                metadata["subscription_id"] = str(order.subscription_id)
            if order.product_id is not None:
                metadata["product_id"] = str(order.product_id)

            events.append(
                {
                    "name": SystemEvent.balance_credit_order,
                    "source": EventSource.system,
                    "timestamp": order.created_at,
                    "customer_id": order.customer.id,
                    "organization_id": order.customer.organization_id,
                    "user_metadata": metadata,
                }
            )

        if events:
            await EventRepository.from_session(session).insert_batch(events)
            await session.commit()
            created_count += len(events)

        last_created_at, last_id = orders[-1].created_at, orders[-1].id
        processed_count += len(orders)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} orders...")
        await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} balance.credit_order events")
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
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.refund events ===")

    typer.echo("Computing refundable amounts for each refund...")
    refundable_amounts = await _compute_refundable_amounts(session)
    typer.echo(f"Computed refundable amounts for {len(refundable_amounts)} refunds")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing refund transactions...")

    while True:
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.refund,
                Transaction.refund_id.is_not(None),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .options(
                selectinload(Transaction.refund).selectinload(Refund.customer),
                selectinload(Transaction.refund).selectinload(Refund.organization),
                selectinload(Transaction.refund).selectinload(Refund.order),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Transaction.created_at, Transaction.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        transactions = batch_result.scalars().all()

        if not transactions:
            break

        batch_tx_ids = [str(tx.id) for tx in transactions]
        existing_result = await session.execute(
            select(Event.user_metadata["transaction_id"].as_string()).where(
                Event.name == SystemEvent.balance_refund,
                Event.source == EventSource.system,
                Event.user_metadata["transaction_id"].as_string().in_(batch_tx_ids),
            )
        )
        existing_tx_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for tx in transactions:
            if str(tx.id) in existing_tx_ids:
                continue

            if tx.refund is None:
                continue
            if tx.refund.customer is None or tx.refund.organization is None:
                continue
            if tx.presentment_amount is None or tx.presentment_currency is None:
                continue

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
                metadata["order_created_at"] = order.created_at.isoformat()
            refund_id_str = str(tx.refund.id)
            if refund_id_str in refundable_amounts:
                metadata["refundable_amount"] = refundable_amounts[refund_id_str]
            if (
                tx.refund.order is not None
                and tx.refund.order.subscription_id is not None
            ):
                metadata["subscription_id"] = str(tx.refund.order.subscription_id)

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

        last_created_at, last_id = transactions[-1].created_at, transactions[-1].id
        processed_count += len(transactions)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} transactions...")
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
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.dispute events ===")

    typer.echo("Computing dispute fees by order...")
    dispute_fees_by_order = await _compute_dispute_fees_by_order(session)
    typer.echo(f"Computed dispute fees for {len(dispute_fees_by_order)} orders")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing dispute transactions...")

    while True:
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.dispute,
                Transaction.dispute_id.is_not(None),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .options(
                selectinload(Transaction.dispute)
                .selectinload(Dispute.order)
                .selectinload(Order.customer)
                .selectinload(Customer.organization),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Transaction.created_at, Transaction.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        transactions = batch_result.scalars().all()

        if not transactions:
            break

        batch_tx_ids = [str(tx.id) for tx in transactions]
        existing_result = await session.execute(
            select(Event.user_metadata["transaction_id"].as_string()).where(
                Event.name == SystemEvent.balance_dispute,
                Event.source == EventSource.system,
                Event.user_metadata["transaction_id"].as_string().in_(batch_tx_ids),
            )
        )
        existing_tx_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for tx in transactions:
            if str(tx.id) in existing_tx_ids:
                continue

            if tx.dispute is None or tx.dispute.order is None:
                continue
            customer = tx.dispute.order.customer
            if customer is None or customer.organization is None:
                continue

            presentment_amount = (
                tx.presentment_amount
                if tx.presentment_amount is not None
                else tx.amount
            )
            presentment_currency = (
                tx.presentment_currency
                if tx.presentment_currency is not None
                else "usd"
            )

            order_id_str = str(tx.order_id) if tx.order_id else None
            metadata: BalanceDisputeMetadata = {
                "transaction_id": str(tx.id),
                "dispute_id": str(tx.dispute.id),
                "amount": tx.amount,
                "currency": tx.currency,
                "presentment_amount": presentment_amount,
                "presentment_currency": presentment_currency,
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
                metadata["order_created_at"] = tx.dispute.order.created_at.isoformat()
                if tx.dispute.order.product_id is not None:
                    metadata["product_id"] = str(tx.dispute.order.product_id)
                if tx.dispute.order.subscription_id is not None:
                    metadata["subscription_id"] = str(tx.dispute.order.subscription_id)

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

        last_created_at, last_id = transactions[-1].created_at, transactions[-1].id
        processed_count += len(transactions)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} transactions...")
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
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.dispute_reversal events ===")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing dispute_reversal transactions...")

    while True:
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.dispute_reversal,
                Transaction.dispute_id.is_not(None),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .options(
                selectinload(Transaction.dispute)
                .selectinload(Dispute.order)
                .selectinload(Order.customer)
                .selectinload(Customer.organization),
                selectinload(Transaction.incurred_transactions),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Transaction.created_at, Transaction.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        transactions = batch_result.scalars().all()

        if not transactions:
            break

        batch_tx_ids = [str(tx.id) for tx in transactions]
        existing_result = await session.execute(
            select(Event.user_metadata["transaction_id"].as_string()).where(
                Event.name == SystemEvent.balance_dispute_reversal,
                Event.source == EventSource.system,
                Event.user_metadata["transaction_id"].as_string().in_(batch_tx_ids),
            )
        )
        existing_tx_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for tx in transactions:
            if str(tx.id) in existing_tx_ids:
                continue

            if tx.dispute is None or tx.dispute.order is None:
                continue
            customer = tx.dispute.order.customer
            if customer is None or customer.organization is None:
                continue

            presentment_amount = (
                tx.presentment_amount
                if tx.presentment_amount is not None
                else tx.amount
            )
            presentment_currency = (
                tx.presentment_currency
                if tx.presentment_currency is not None
                else "usd"
            )

            reversal_fee = sum(-fee.amount for fee in tx.incurred_transactions)

            metadata: BalanceDisputeMetadata = {
                "transaction_id": str(tx.id),
                "dispute_id": str(tx.dispute.id),
                "amount": tx.amount,
                "currency": tx.currency,
                "presentment_amount": presentment_amount,
                "presentment_currency": presentment_currency,
                "tax_amount": tx.tax_amount,
                "tax_country": tx.tax_country or "",
                "tax_state": tx.tax_state or "",
                "fee": reversal_fee,
            }
            if tx.order_id is not None:
                metadata["order_id"] = str(tx.order_id)
            if tx.dispute.order is not None:
                metadata["order_created_at"] = tx.dispute.order.created_at.isoformat()
                if tx.dispute.order.product_id is not None:
                    metadata["product_id"] = str(tx.dispute.order.product_id)
                if tx.dispute.order.subscription_id is not None:
                    metadata["subscription_id"] = str(tx.dispute.order.subscription_id)

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

        last_created_at, last_id = transactions[-1].created_at, transactions[-1].id
        processed_count += len(transactions)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} transactions...")
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
    Uses batch-check pattern to avoid querying all existing events upfront.
    """
    typer.echo("\n=== Creating missing balance.refund_reversal events ===")

    created_count = 0
    last_created_at, last_id = None, None
    processed_count = 0

    typer.echo("Processing refund_reversal transactions...")

    while True:
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.refund_reversal,
                Transaction.refund_id.is_not(None),
            )
            .order_by(Transaction.created_at, Transaction.id)
            .limit(batch_size)
            .options(
                selectinload(Transaction.refund).selectinload(Refund.customer),
                selectinload(Transaction.refund).selectinload(Refund.organization),
                selectinload(Transaction.refund).selectinload(Refund.order),
            )
        )
        if last_created_at is not None:
            query = query.where(
                tuple_(Transaction.created_at, Transaction.id)
                > tuple_(literal(last_created_at), literal(last_id))
            )

        batch_result = await session.execute(query)
        transactions = batch_result.scalars().all()

        if not transactions:
            break

        batch_tx_ids = [str(tx.id) for tx in transactions]
        existing_result = await session.execute(
            select(Event.user_metadata["transaction_id"].as_string()).where(
                Event.name == SystemEvent.balance_refund_reversal,
                Event.source == EventSource.system,
                Event.user_metadata["transaction_id"].as_string().in_(batch_tx_ids),
            )
        )
        existing_tx_ids = {row[0] for row in existing_result.fetchall()}

        events = []
        for tx in transactions:
            if str(tx.id) in existing_tx_ids:
                continue

            if tx.refund is None:
                continue
            if tx.refund.customer is None or tx.refund.organization is None:
                continue
            if tx.presentment_amount is None or tx.presentment_currency is None:
                continue

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
                metadata["order_created_at"] = order.created_at.isoformat()
                if order.subscription_id is not None:
                    metadata["subscription_id"] = str(order.subscription_id)

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

        last_created_at, last_id = transactions[-1].created_at, transactions[-1].id
        processed_count += len(transactions)
        if processed_count % 10000 == 0:
            typer.echo(f"  Processed {processed_count} transactions...")
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
            command_timeout=300,  # 5 minutes for long-running backfill queries
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    results: dict[str, int] = {}

    try:
        results["duplicates_deleted"] = await delete_duplicate_balance_order_events(
            session
        )
        results["timestamps_fixed"] = await fix_balance_order_timestamps(
            session, batch_size
        )
        results["fees_fixed"] = await fix_balance_order_fees(session, batch_size)
        results["refund_subscription_id_added"] = await fix_refund_subscription_id(
            session, batch_size
        )
        results["refund_order_created_at_added"] = await fix_refund_order_created_at(
            session, batch_size
        )
        results["dispute_order_created_at_added"] = await fix_dispute_order_created_at(
            session, batch_size
        )
        results[
            "dispute_reversal_order_created_at_added"
        ] = await fix_dispute_reversal_order_created_at(session, batch_size)
        results[
            "refund_reversal_order_created_at_added"
        ] = await fix_refund_reversal_order_created_at(session, batch_size)

        results["balance_order_created"] = await create_missing_balance_order_events(
            session, batch_size, rate_limit_delay
        )
        results[
            "balance_credit_order_created"
        ] = await create_missing_balance_credit_order_events(
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

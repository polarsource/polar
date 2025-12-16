import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import String, func, or_, select, update
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import (
    CheckoutCreatedMetadata,
    SubscriptionCanceledMetadata,
    SubscriptionCreatedMetadata,
    SubscriptionRevokedMetadata,
    SystemEvent,
)
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Checkout, Event, Order, Subscription
from polar.models.checkout import CheckoutStatus
from polar.models.event import EventSource
from polar.models.subscription import SubscriptionStatus

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def backfill_order_paid_metadata(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Backfill missing metadata fields for order.paid events.
    Fields added: currency, net_amount, tax_amount, applied_balance_amount,
    discount_amount, discount_id, platform_fee, subscription_id,
    recurring_interval, recurring_interval_count
    """
    typer.echo("\n=== Backfilling order.paid metadata ===")

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.name == SystemEvent.order_paid,
            Event.source == EventSource.system,
            or_(
                Event.user_metadata["currency"].is_(None),
                Event.user_metadata["net_amount"].is_(None),
            ),
        )
    )
    total_to_update = count_result.scalar() or 0

    if total_to_update == 0:
        typer.echo("No order.paid events need metadata backfill")
        return 0

    typer.echo(f"Found {total_to_update} order.paid events to update")

    updated_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Updating order.paid metadata...", total=total_to_update
        )

        while True:
            statement = (
                select(Event)
                .where(
                    Event.name == SystemEvent.order_paid,
                    Event.source == EventSource.system,
                    or_(
                        Event.user_metadata["currency"].is_(None),
                        Event.user_metadata["net_amount"].is_(None),
                    ),
                )
                .order_by(Event.timestamp.asc())
                .limit(batch_size)
            )

            result = await session.execute(statement)
            events = result.scalars().all()

            if not events:
                break
            order_ids = [
                e.user_metadata.get("order_id") for e in events if e.user_metadata
            ]

            orders_result = await session.execute(
                select(Order)
                .where(Order.id.cast(String).in_(order_ids))
                .options(selectinload(Order.subscription), selectinload(Order.product))
            )
            orders_by_id = {str(o.id): o for o in orders_result.scalars().all()}

            for event in events:
                order_id = event.user_metadata.get("order_id")
                if not order_id:
                    typer.echo(f"Warning: Event {event.id} has no order_id in metadata")
                    continue
                if order_id not in orders_by_id:
                    typer.echo(
                        f"Warning: Order {order_id} not found for event {event.id}"
                    )
                    continue

                order = orders_by_id[order_id]
                metadata = dict(event.user_metadata)

                metadata["product_id"] = str(order.product_id)
                metadata["billing_type"] = (
                    order.product.billing_type.value if order.product else "one_time"
                )
                metadata["currency"] = order.currency
                metadata["net_amount"] = order.net_amount
                metadata["tax_amount"] = order.tax_amount
                metadata["applied_balance_amount"] = order.applied_balance_amount
                metadata["discount_amount"] = order.discount_amount
                metadata["platform_fee"] = order.platform_fee_amount

                if order.discount_id:
                    metadata["discount_id"] = str(order.discount_id)

                if order.subscription_id:
                    metadata["subscription_id"] = str(order.subscription_id)
                    if order.subscription:
                        sub = order.subscription
                        metadata["recurring_interval"] = sub.recurring_interval.value
                        metadata["recurring_interval_count"] = (
                            sub.recurring_interval_count
                        )

                await session.execute(
                    update(Event)
                    .where(Event.id == event.id)
                    .values(user_metadata=metadata)
                )
                updated_count += 1

            await session.commit()
            progress.update(task, advance=len(events))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Updated {updated_count} order.paid events")
    return updated_count


async def backfill_subscription_revoked_metadata(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Backfill missing metadata fields for subscription.revoked events.
    Fields added: product_id, amount, recurring_interval, recurring_interval_count
    """
    typer.echo("\n=== Backfilling subscription.revoked metadata ===")

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.name == SystemEvent.subscription_revoked,
            Event.source == EventSource.system,
            Event.user_metadata["amount"].is_(None),
        )
    )
    total_to_update = count_result.scalar() or 0

    if total_to_update == 0:
        typer.echo("No subscription.revoked events need metadata backfill")
        return 0

    typer.echo(f"Found {total_to_update} subscription.revoked events to update")

    updated_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Updating subscription.revoked metadata...", total=total_to_update
        )

        while True:
            statement = (
                select(Event)
                .where(
                    Event.name == SystemEvent.subscription_revoked,
                    Event.source == EventSource.system,
                    Event.user_metadata["amount"].is_(None),
                )
                .order_by(Event.timestamp.asc())
                .limit(batch_size)
            )

            result = await session.execute(statement)
            events = result.scalars().all()

            if not events:
                break
            subscription_ids = [
                e.user_metadata.get("subscription_id")
                for e in events
                if e.user_metadata
            ]

            subs_result = await session.execute(
                select(Subscription).where(
                    Subscription.id.cast(String).in_(subscription_ids)
                )
            )
            subs_by_id = {str(s.id): s for s in subs_result.scalars().all()}

            for event in events:
                sub_id = event.user_metadata.get("subscription_id")
                if not sub_id:
                    typer.echo(
                        f"Warning: Event {event.id} has no subscription_id in metadata"
                    )
                    continue
                if sub_id not in subs_by_id:
                    typer.echo(
                        f"Warning: Subscription {sub_id} not found for event {event.id}"
                    )
                    continue

                sub = subs_by_id[sub_id]
                metadata = dict(event.user_metadata)

                metadata["product_id"] = str(sub.product_id)
                metadata["amount"] = sub.amount
                metadata["currency"] = sub.currency
                metadata["recurring_interval"] = sub.recurring_interval.value
                metadata["recurring_interval_count"] = sub.recurring_interval_count

                await session.execute(
                    update(Event)
                    .where(Event.id == event.id)
                    .values(user_metadata=metadata)
                )
                updated_count += 1

            await session.commit()
            progress.update(task, advance=len(events))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Updated {updated_count} subscription.revoked events")
    return updated_count


async def backfill_subscription_cycled_metadata(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Backfill missing metadata fields for subscription.cycled events.
    Fields added: product_id, amount, currency
    """
    typer.echo("\n=== Backfilling subscription.cycled metadata ===")

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.name == SystemEvent.subscription_cycled,
            Event.source == EventSource.system,
            Event.user_metadata["amount"].is_(None),
        )
    )
    total_to_update = count_result.scalar() or 0

    if total_to_update == 0:
        typer.echo("No subscription.cycled events need metadata backfill")
        return 0

    typer.echo(f"Found {total_to_update} subscription.cycled events to update")

    updated_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Updating subscription.cycled metadata...", total=total_to_update
        )

        while True:
            statement = (
                select(Event)
                .where(
                    Event.name == SystemEvent.subscription_cycled,
                    Event.source == EventSource.system,
                    Event.user_metadata["amount"].is_(None),
                )
                .order_by(Event.timestamp.asc())
                .limit(batch_size)
            )

            result = await session.execute(statement)
            events = result.scalars().all()

            if not events:
                break
            subscription_ids = [
                e.user_metadata.get("subscription_id")
                for e in events
                if e.user_metadata
            ]

            subs_result = await session.execute(
                select(Subscription).where(
                    Subscription.id.cast(String).in_(subscription_ids)
                )
            )
            subs_by_id = {str(s.id): s for s in subs_result.scalars().all()}

            for event in events:
                sub_id = event.user_metadata.get("subscription_id")
                if not sub_id:
                    typer.echo(
                        f"Warning: Event {event.id} has no subscription_id in metadata"
                    )
                    continue
                if sub_id not in subs_by_id:
                    typer.echo(
                        f"Warning: Subscription {sub_id} not found for event {event.id}"
                    )
                    continue

                sub = subs_by_id[sub_id]
                metadata = dict(event.user_metadata)

                metadata["product_id"] = str(sub.product_id)
                metadata["amount"] = sub.amount
                metadata["currency"] = sub.currency
                metadata["recurring_interval"] = sub.recurring_interval.value
                metadata["recurring_interval_count"] = sub.recurring_interval_count

                await session.execute(
                    update(Event)
                    .where(Event.id == event.id)
                    .values(user_metadata=metadata)
                )
                updated_count += 1

            await session.commit()
            progress.update(task, advance=len(events))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Updated {updated_count} subscription.cycled events")
    return updated_count


async def backfill_subscription_canceled_metadata(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Backfill missing metadata fields for subscription.canceled events.
    Fields added: product_id, amount, currency, recurring_interval, recurring_interval_count,
    cancel_at_period_end
    """
    typer.echo("\n=== Backfilling subscription.canceled metadata ===")

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.name == SystemEvent.subscription_canceled,
            Event.source == EventSource.system,
            or_(
                Event.user_metadata["amount"].is_(None),
                Event.user_metadata["cancel_at_period_end"].is_(None),
            ),
        )
    )
    total_to_update = count_result.scalar() or 0

    if total_to_update == 0:
        typer.echo("No subscription.canceled events need metadata backfill")
        return 0

    typer.echo(f"Found {total_to_update} subscription.canceled events to update")

    updated_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Updating subscription.canceled metadata...", total=total_to_update
        )

        while True:
            statement = (
                select(Event)
                .where(
                    Event.name == SystemEvent.subscription_canceled,
                    Event.source == EventSource.system,
                    or_(
                        Event.user_metadata["amount"].is_(None),
                        Event.user_metadata["cancel_at_period_end"].is_(None),
                    ),
                )
                .order_by(Event.timestamp.asc())
                .limit(batch_size)
            )

            result = await session.execute(statement)
            events = result.scalars().all()

            if not events:
                break
            subscription_ids = [
                e.user_metadata.get("subscription_id")
                for e in events
                if e.user_metadata
            ]

            subs_result = await session.execute(
                select(Subscription).where(
                    Subscription.id.cast(String).in_(subscription_ids)
                )
            )
            subs_by_id = {str(s.id): s for s in subs_result.scalars().all()}

            for event in events:
                sub_id = event.user_metadata.get("subscription_id")
                if not sub_id:
                    typer.echo(
                        f"Warning: Event {event.id} has no subscription_id in metadata"
                    )
                    continue
                if sub_id not in subs_by_id:
                    typer.echo(
                        f"Warning: Subscription {sub_id} not found for event {event.id}"
                    )
                    continue

                sub = subs_by_id[sub_id]
                metadata = dict(event.user_metadata)

                metadata["product_id"] = str(sub.product_id)
                metadata["amount"] = sub.amount
                metadata["currency"] = sub.currency
                metadata["recurring_interval"] = sub.recurring_interval.value
                metadata["recurring_interval_count"] = sub.recurring_interval_count
                metadata["cancel_at_period_end"] = sub.cancel_at_period_end

                await session.execute(
                    update(Event)
                    .where(Event.id == event.id)
                    .values(user_metadata=metadata)
                )
                updated_count += 1

            await session.commit()
            progress.update(task, advance=len(events))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Updated {updated_count} subscription.canceled events")
    return updated_count


async def backfill_subscription_created_canceled_product_id(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Backfill product_id for subscription.created and subscription.canceled events
    that are missing it. This handles events created before the product_id field was added.
    """
    typer.echo("\n=== Backfilling subscription.created/canceled product_id ===")

    event_names = [
        SystemEvent.subscription_created,
        SystemEvent.subscription_canceled,
    ]

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.name.in_(event_names),
            Event.source == EventSource.system,
            Event.user_metadata["product_id"].is_(None),
        )
    )
    total_to_update = count_result.scalar() or 0

    if total_to_update == 0:
        typer.echo("No subscription.created/canceled events need product_id backfill")
        return 0

    typer.echo(
        f"Found {total_to_update} subscription.created/canceled events to update"
    )

    updated_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Updating subscription.created/canceled product_id...",
            total=total_to_update,
        )

        while True:
            statement = (
                select(Event)
                .where(
                    Event.name.in_(event_names),
                    Event.source == EventSource.system,
                    Event.user_metadata["product_id"].is_(None),
                )
                .order_by(Event.timestamp.asc())
                .limit(batch_size)
            )

            result = await session.execute(statement)
            events = result.scalars().all()

            if not events:
                break

            subscription_ids = [
                e.user_metadata.get("subscription_id")
                for e in events
                if e.user_metadata
            ]

            subs_result = await session.execute(
                select(Subscription).where(
                    Subscription.id.cast(String).in_(subscription_ids)
                )
            )
            subs_by_id = {str(s.id): s for s in subs_result.scalars().all()}

            for event in events:
                sub_id = event.user_metadata.get("subscription_id")
                if not sub_id:
                    typer.echo(
                        f"Warning: Event {event.id} has no subscription_id in metadata"
                    )
                    continue
                if sub_id not in subs_by_id:
                    typer.echo(
                        f"Warning: Subscription {sub_id} not found for event {event.id}"
                    )
                    continue

                sub = subs_by_id[sub_id]
                metadata = dict(event.user_metadata)
                metadata["product_id"] = str(sub.product_id)

                await session.execute(
                    update(Event)
                    .where(Event.id == event.id)
                    .values(user_metadata=metadata)
                )
                updated_count += 1

            await session.commit()
            progress.update(task, advance=len(events))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(
        f"Updated {updated_count} subscription.created/canceled events with product_id"
    )
    return updated_count


async def create_missing_subscription_created_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create subscription.created events for subscriptions that don't have one.
    """
    typer.echo("\n=== Creating missing subscription.created events ===")

    existing_sub_ids_result = await session.execute(
        select(Event.user_metadata["subscription_id"].as_string())
        .where(
            Event.name == SystemEvent.subscription_created,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_sub_ids = {row[0] for row in existing_sub_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_sub_ids)} existing subscription.created events")

    all_sub_ids_result = await session.execute(
        select(Subscription.id).where(
            Subscription.deleted_at.is_(None),
            Subscription.started_at.is_not(None),
        )
    )
    all_sub_ids = [row[0] for row in all_sub_ids_result.fetchall()]

    missing_sub_ids = [
        sub_id for sub_id in all_sub_ids if str(sub_id) not in existing_sub_ids
    ]
    total_to_create = len(missing_sub_ids)

    if total_to_create == 0:
        typer.echo("No missing subscription.created events to create")
        return 0

    typer.echo(f"Found {total_to_create} subscriptions without created events")

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating subscription.created events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_sub_ids[i : i + batch_size]

            statement = (
                select(Subscription)
                .where(Subscription.id.in_(batch_ids))
                .options(selectinload(Subscription.customer))
            )

            result = await session.execute(statement)
            subscriptions = result.scalars().all()

            if not subscriptions:
                break

            events = []
            for sub in subscriptions:
                events.append(
                    {
                        "name": SystemEvent.subscription_created,
                        "source": EventSource.system,
                        "timestamp": sub.started_at,
                        "customer_id": sub.customer_id,
                        "organization_id": sub.customer.organization_id,
                        "user_metadata": SubscriptionCreatedMetadata(
                            subscription_id=str(sub.id),
                            product_id=str(sub.product_id),
                            amount=sub.amount,
                            currency=sub.currency,
                            recurring_interval=sub.recurring_interval.value,
                            recurring_interval_count=sub.recurring_interval_count,
                            started_at=sub.started_at.isoformat()
                            if sub.started_at
                            else "",
                        ),
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(subscriptions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} subscription.created events")
    return created_count


async def create_missing_subscription_canceled_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create subscription.canceled events for canceled subscriptions that don't have one.
    """
    typer.echo("\n=== Creating missing subscription.canceled events ===")

    existing_sub_ids_result = await session.execute(
        select(Event.user_metadata["subscription_id"].as_string())
        .where(
            Event.name == SystemEvent.subscription_canceled,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_sub_ids = {row[0] for row in existing_sub_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_sub_ids)} existing subscription.canceled events")

    all_sub_ids_result = await session.execute(
        select(Subscription.id).where(
            Subscription.deleted_at.is_(None),
            Subscription.canceled_at.is_not(None),
        )
    )
    all_sub_ids = [row[0] for row in all_sub_ids_result.fetchall()]

    missing_sub_ids = [
        sub_id for sub_id in all_sub_ids if str(sub_id) not in existing_sub_ids
    ]
    total_to_create = len(missing_sub_ids)

    if total_to_create == 0:
        typer.echo("No missing subscription.canceled events to create")
        return 0

    typer.echo(f"Found {total_to_create} canceled subscriptions without events")

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating subscription.canceled events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_sub_ids[i : i + batch_size]

            statement = (
                select(Subscription)
                .where(Subscription.id.in_(batch_ids))
                .options(selectinload(Subscription.customer))
            )

            result = await session.execute(statement)
            subscriptions = result.scalars().all()

            if not subscriptions:
                break

            events = []
            for sub in subscriptions:
                metadata = SubscriptionCanceledMetadata(
                    subscription_id=str(sub.id),
                    product_id=str(sub.product_id),
                    amount=sub.amount,
                    currency=sub.currency,
                    recurring_interval=sub.recurring_interval.value,
                    recurring_interval_count=sub.recurring_interval_count,
                    canceled_at=sub.canceled_at.isoformat() if sub.canceled_at else "",
                )
                if sub.customer_cancellation_reason:
                    metadata["customer_cancellation_reason"] = (
                        sub.customer_cancellation_reason
                    )
                if sub.customer_cancellation_comment:
                    metadata["customer_cancellation_comment"] = (
                        sub.customer_cancellation_comment
                    )
                if sub.ends_at:
                    metadata["ends_at"] = sub.ends_at.isoformat()
                metadata["cancel_at_period_end"] = sub.cancel_at_period_end

                events.append(
                    {
                        "name": SystemEvent.subscription_canceled,
                        "source": EventSource.system,
                        "timestamp": sub.canceled_at,
                        "customer_id": sub.customer_id,
                        "organization_id": sub.customer.organization_id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(subscriptions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} subscription.canceled events")
    return created_count


async def create_missing_subscription_revoked_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create subscription.revoked events for revoked subscriptions that don't have one.
    """
    typer.echo("\n=== Creating missing subscription.revoked events ===")

    existing_sub_ids_result = await session.execute(
        select(Event.user_metadata["subscription_id"].as_string())
        .where(
            Event.name == SystemEvent.subscription_revoked,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_sub_ids = {row[0] for row in existing_sub_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_sub_ids)} existing subscription.revoked events")

    all_sub_ids_result = await session.execute(
        select(Subscription.id).where(
            Subscription.deleted_at.is_(None),
            Subscription.status.in_(SubscriptionStatus.revoked_statuses()),
        )
    )
    all_sub_ids = [row[0] for row in all_sub_ids_result.fetchall()]

    missing_sub_ids = [
        sub_id for sub_id in all_sub_ids if str(sub_id) not in existing_sub_ids
    ]
    total_to_create = len(missing_sub_ids)

    if total_to_create == 0:
        typer.echo("No missing subscription.revoked events to create")
        return 0

    typer.echo(f"Found {total_to_create} revoked subscriptions without events")

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating subscription.revoked events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_sub_ids[i : i + batch_size]

            statement = (
                select(Subscription)
                .where(Subscription.id.in_(batch_ids))
                .options(selectinload(Subscription.customer))
            )

            result = await session.execute(statement)
            subscriptions = result.scalars().all()

            if not subscriptions:
                break

            events = []
            for sub in subscriptions:
                events.append(
                    {
                        "name": SystemEvent.subscription_revoked,
                        "source": EventSource.system,
                        "timestamp": sub.ended_at,
                        "customer_id": sub.customer_id,
                        "organization_id": sub.customer.organization_id,
                        "user_metadata": SubscriptionRevokedMetadata(
                            subscription_id=str(sub.id),
                            product_id=str(sub.product_id),
                            amount=sub.amount,
                            currency=sub.currency,
                            recurring_interval=sub.recurring_interval.value,
                            recurring_interval_count=sub.recurring_interval_count,
                        ),
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(subscriptions))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} subscription.revoked events")
    return created_count


async def create_missing_checkout_created_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Create checkout.created events for checkouts that don't have one.
    """
    typer.echo("\n=== Creating missing checkout.created events ===")

    existing_checkout_ids_result = await session.execute(
        select(Event.user_metadata["checkout_id"].as_string())
        .where(
            Event.name == SystemEvent.checkout_created,
            Event.source == EventSource.system,
        )
        .distinct()
    )
    existing_checkout_ids = {row[0] for row in existing_checkout_ids_result.fetchall()}
    typer.echo(f"Found {len(existing_checkout_ids)} existing checkout.created events")

    all_checkout_ids_result = await session.execute(
        select(Checkout.id).where(Checkout.deleted_at.is_(None))
    )
    all_checkout_ids = [row[0] for row in all_checkout_ids_result.fetchall()]

    missing_checkout_ids = [
        checkout_id
        for checkout_id in all_checkout_ids
        if str(checkout_id) not in existing_checkout_ids
    ]
    total_to_create = len(missing_checkout_ids)

    if total_to_create == 0:
        typer.echo("No missing checkout.created events to create")
        return 0

    typer.echo(f"Found {total_to_create} checkouts without created events")

    created_count = 0

    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Creating checkout.created events...", total=total_to_create
        )

        for i in range(0, total_to_create, batch_size):
            batch_ids = missing_checkout_ids[i : i + batch_size]

            statement = (
                select(Checkout)
                .where(Checkout.id.in_(batch_ids))
                .options(selectinload(Checkout.organization))
            )

            result = await session.execute(statement)
            checkouts = result.scalars().all()

            if not checkouts:
                break

            events = []
            for checkout in checkouts:
                metadata = CheckoutCreatedMetadata(
                    checkout_id=str(checkout.id),
                    checkout_status=CheckoutStatus.open,
                )
                if checkout.product_id:
                    metadata["product_id"] = str(checkout.product_id)

                events.append(
                    {
                        "name": SystemEvent.checkout_created,
                        "source": EventSource.system,
                        "timestamp": checkout.created_at,
                        "customer_id": None,
                        "organization_id": checkout.organization_id,
                        "user_metadata": metadata,
                    }
                )

            if events:
                await EventRepository.from_session(session).insert_batch(events)
                await session.commit()
                created_count += len(events)

            progress.update(task, advance=len(checkouts))
            await asyncio.sleep(rate_limit_delay)

    typer.echo(f"Created {created_count} checkout.created events")
    return created_count


async def run_backfill(
    batch_size: int = settings.DATABASE_STREAM_YIELD_PER,
    rate_limit_delay: float = 0.5,
    session: AsyncSession | None = None,
) -> dict[str, int]:
    """
    Run all backfill operations for system events.
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
        results["order_paid_updated"] = await backfill_order_paid_metadata(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_revoked_updated"
        ] = await backfill_subscription_revoked_metadata(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_cycled_updated"
        ] = await backfill_subscription_cycled_metadata(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_canceled_updated"
        ] = await backfill_subscription_canceled_metadata(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_created_canceled_product_id"
        ] = await backfill_subscription_created_canceled_product_id(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_created_events"
        ] = await create_missing_subscription_created_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_canceled_events"
        ] = await create_missing_subscription_canceled_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "subscription_revoked_events"
        ] = await create_missing_subscription_revoked_events(
            session, batch_size, rate_limit_delay
        )

        results[
            "checkout_created_events"
        ] = await create_missing_checkout_created_events(
            session, batch_size, rate_limit_delay
        )

        typer.echo("\n" + "=" * 50)
        typer.echo("BACKFILL SUMMARY")
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
    Backfill system events metadata and create missing events.

    This script:
    1. Updates order.paid events with missing metadata fields
    2. Updates subscription.revoked events with missing metadata fields
    3. Updates subscription.cycled events with missing metadata fields
    4. Updates subscription.canceled events with missing metadata fields
    5. Creates subscription.created events for existing subscriptions
    6. Creates subscription.canceled events for canceled subscriptions
    7. Creates subscription.revoked events for revoked subscriptions
    8. Creates checkout.created events for existing checkouts
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    await run_backfill(batch_size=batch_size, rate_limit_delay=rate_limit_delay)


if __name__ == "__main__":
    cli()

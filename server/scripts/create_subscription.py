import asyncio
import logging.config
from datetime import UTC, datetime
from functools import wraps
from typing import Any
from uuid import UUID

import dramatiq
import structlog
import typer
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar import tasks  # noqa: F401
from polar.billing_entry.repository import BillingEntryRepository
from polar.event.service import event as event_service
from polar.event.system import (
    SubscriptionCycledMetadata,
    SystemEvent,
    build_system_event,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Customer, Subscription
from polar.models.billing_entry import (
    BillingEntry,
    BillingEntryDirection,
    BillingEntryType,
)
from polar.models.order import OrderBillingReasonInternal
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import create_async_engine
from polar.product.guard import is_recurring_product, is_seat_price, is_static_price
from polar.product.price_set import PriceSet
from polar.product.repository import ProductRepository
from polar.redis import create_redis
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
from polar.worker import JobQueueManager, enqueue_job

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
async def create_subscription(
    product_id: UUID = typer.Argument(..., help="Product ID to subscribe to"),
    customer_id: UUID = typer.Argument(
        ..., help="Customer ID to create the subscription for"
    ),
    force_current_period_end: datetime | None = typer.Option(
        None,
        "--current-period-end",
        help=(
            "Override the computed current_period_end (ISO 8601, e.g. 2026-12-31T00:00:00). "
            "The full amount is still charged; no proration is applied."
        ),
        formats=["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"],
    ),
) -> None:
    """Create a new subscription for a customer on a given product.

    Sanity checks:
    - Product must be a recurring product
    - Customer and product must belong to the same organization
    - Customer must have a payment method attached
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")

    async with JobQueueManager.open(dramatiq.get_broker(), redis) as job_queue_manager:
        async with sessionmaker() as session:
            product_repository = ProductRepository.from_session(session)
            product = await product_repository.get_by_id(
                product_id,
                options=product_repository.get_eager_options(),
            )

            if product is None:
                typer.echo(f"Error: Product with ID {product_id} not found", err=True)
                raise typer.Exit(1)

            if not is_recurring_product(product):
                typer.echo(
                    f"Error: Product {product_id} is not a recurring product", err=True
                )
                raise typer.Exit(1)

            # Load customer with organization and default payment method
            stmt = (
                select(Customer)
                .where(
                    Customer.id == customer_id,
                    Customer.deleted_at.is_(None),
                )
                .options(
                    joinedload(Customer.organization),
                    joinedload(Customer.default_payment_method),
                )
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer is None:
                typer.echo(f"Error: Customer with ID {customer_id} not found", err=True)
                raise typer.Exit(1)

            # Sanity check: customer and product must be on the same org
            if customer.organization_id != product.organization_id:
                typer.echo(
                    "Error: Customer and product belong to different organizations",
                    err=True,
                )
                raise typer.Exit(1)

            # Sanity check: customer must have a payment method
            payment_method_repository = PaymentMethodRepository.from_session(session)
            payment_methods = await payment_method_repository.list_by_customer(
                customer.id
            )
            if not payment_methods:
                typer.echo(
                    f"Error: Customer {customer_id} has no payment method attached",
                    err=True,
                )
                raise typer.Exit(1)

            payment_method = customer.default_payment_method or payment_methods[0]

            # Build subscription product prices
            currency = product.organization.default_presentment_currency
            currency_prices = PriceSet.from_product(product, currency)

            seats: int | None = None
            if product.has_seat_based_price:
                for p in currency_prices:
                    if is_seat_price(p):
                        seats = p.get_minimum_seats()
                        break

            subscription_product_prices: list[SubscriptionProductPrice] = []
            for price in currency_prices:
                subscription_product_prices.append(
                    SubscriptionProductPrice.from_price(price, seats=seats)
                )

            recurring_interval = product.recurring_interval
            recurring_interval_count = product.recurring_interval_count

            current_period_start = utc_now()
            current_period_end = recurring_interval.get_next_period(
                current_period_start,
                current_period_start.day,
                recurring_interval_count,
            )

            if force_current_period_end is not None:
                # Typer parses datetime as naive; attach UTC so the value is
                # timezone-aware and consistent with the rest of the codebase.
                if force_current_period_end.tzinfo is None:
                    force_current_period_end = force_current_period_end.replace(
                        tzinfo=UTC
                    )
                current_period_end = force_current_period_end

            # When the period end is forced to an arbitrary date, anchor future
            # billing cycles to that date's day-of-month so subsequent periods
            # don't drift back to the start day.
            anchor_day = (
                current_period_end.day
                if force_current_period_end is not None
                else current_period_start.day
            )

            subscription = Subscription(
                status=SubscriptionStatus.active,
                started_at=current_period_start,
                anchor_day=anchor_day,
                current_period_start=current_period_start,
                current_period_end=current_period_end,
                cancel_at_period_end=False,
                recurring_interval=recurring_interval,
                recurring_interval_count=recurring_interval_count,
                organization=product.organization,
                product=product,
                customer=customer,
                subscription_product_prices=subscription_product_prices,
                currency=currency,
                seats=seats,
                payment_method=payment_method,
                pending_update=None,
            )

            subscription_repository = SubscriptionRepository.from_session(session)
            subscription = await subscription_repository.create(
                subscription, flush=True
            )

            # Create a system event to associate with the billing entries
            cycle_event = await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.subscription_cycled,
                    customer=subscription.customer,
                    organization=subscription.organization,
                    metadata=SubscriptionCycledMetadata(
                        subscription_id=str(subscription.id),
                        product_id=str(subscription.product_id),
                        amount=subscription.amount,
                        currency=subscription.currency,
                        recurring_interval=subscription.recurring_interval.value,
                        recurring_interval_count=subscription.recurring_interval_count,
                    ),
                ),
            )

            # Create billing entries for the initial period (like cycle() does)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            for subscription_product_price in subscription.subscription_product_prices:
                product_price = subscription_product_price.product_price
                if is_static_price(product_price):
                    discount_amount = 0
                    await billing_entry_repository.create(
                        BillingEntry(
                            start_timestamp=subscription.current_period_start,
                            end_timestamp=subscription.current_period_end,
                            type=BillingEntryType.cycle,
                            direction=BillingEntryDirection.debit,
                            amount=subscription_product_price.amount,
                            currency=subscription.currency,
                            customer=subscription.customer,
                            product_price=product_price,
                            discount=None,
                            discount_amount=discount_amount,
                            subscription=subscription,
                            event=cycle_event,
                        ),
                    )

            await subscription_service._after_subscription_created(
                session, subscription
            )
            await subscription_service._on_subscription_updated(session, subscription)
            await subscription_service.enqueue_benefits_grants(session, subscription)

            await session.commit()

            enqueue_job(
                "order.create_subscription_order",
                subscription.id,
                OrderBillingReasonInternal.subscription_create,
            )

            await job_queue_manager.flush(dramatiq.get_broker(), redis)

            typer.echo(
                f"✅ Created subscription {subscription.id} for customer {customer_id} "
                f"on product {product_id}"
            )


if __name__ == "__main__":
    cli()

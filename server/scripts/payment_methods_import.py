import asyncio
import logging.config
import random
from asyncio.tasks import Task
from datetime import UTC, datetime
from functools import wraps
from typing import Any
from uuid import UUID

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import func, select, tablesample, text
from sqlalchemy.orm import aliased

from polar.enums import PaymentProcessor
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, PaymentMethod, Subscription
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


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


semaphore = asyncio.Semaphore(64)


async def migrate_customer(
    customer: Customer, retry: int = 1
) -> list[tuple[PaymentMethod, bool]]:
    assert customer.stripe_customer_id is not None
    methods: list[tuple[PaymentMethod, bool]] = []
    try:
        async with semaphore:
            stripe_customer = await stripe_lib.Customer.retrieve_async(
                customer.stripe_customer_id
            )
            default_payment_method_id = (
                get_expandable_id(
                    stripe_customer.invoice_settings.default_payment_method
                )
                if stripe_customer.invoice_settings
                and stripe_customer.invoice_settings.default_payment_method
                else None
            )
            stripe_methods = await stripe_lib.PaymentMethod.list_async(
                customer=customer.stripe_customer_id, limit=100
            )
        for method in stripe_methods.data:
            payment_method = PaymentMethod(
                created_at=datetime.fromtimestamp(method.created, UTC),
                processor=PaymentProcessor.stripe,
                processor_id=method.id,
                type=method.type,
                method_metadata=method[method.type],
                customer=customer,
            )
            default = method.id == default_payment_method_id
            methods.append((payment_method, default))
        return methods
    except stripe_lib.RateLimitError:
        await asyncio.sleep(retry + random.random())
        return await migrate_customer(customer, retry=retry + 1)
    except stripe_lib.InvalidRequestError as e:
        if "No such customer" in str(e):
            # If the customer does not exist, we skip it
            return []
        raise e


async def migrate_subscription(
    subscription: Subscription, retry: int = 1
) -> tuple[UUID, UUID, str | None]:
    assert subscription.stripe_subscription_id is not None
    methods: list[tuple[PaymentMethod, bool]] = []
    try:
        async with semaphore:
            stripe_subscription = await stripe_lib.Subscription.retrieve_async(
                subscription.stripe_subscription_id,
                expand=["default_payment_method"],
            )
            payment_method_id = (
                get_expandable_id(stripe_subscription.default_payment_method)
                if stripe_subscription.default_payment_method
                else None
            )
            return (subscription.id, subscription.customer_id, payment_method_id)
    except stripe_lib.RateLimitError:
        await asyncio.sleep(retry + random.random())
        return await migrate_subscription(subscription, retry=retry + 1)
    except stripe_lib.InvalidRequestError as e:
        if "No such subscription" in str(e):
            return (subscription.id, subscription.customer_id, None)
        raise e


@cli.command()
@typer_async
async def payment_methods_import(
    stripe_api_key: str, sample: float | None = None
) -> None:
    stripe_lib.api_key = stripe_api_key
    stripe_lib.api_version = "2025-02-24.acacia"
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        customer_table = (
            Customer
            if sample is None
            else aliased(Customer, tablesample(Customer, func.bernoulli(sample)))
        )
        customers_statement = select(customer_table).where(
            customer_table.stripe_customer_id.is_not(None),
            customer_table.id.not_in(select(PaymentMethod.customer_id)),
        )
        customers = await session.stream_scalars(customers_statement)

        subscription_table = (
            Subscription
            if sample is None
            else aliased(
                Subscription, tablesample(Subscription, func.bernoulli(sample))
            )
        )
        subscriptions_statement = select(subscription_table).where(
            subscription_table.stripe_subscription_id.is_not(None)
        )
        subscriptions = await session.stream_scalars(subscriptions_statement)

        with Progress() as progress:
            tasks: list[Task[list[tuple[PaymentMethod, bool]]]] = []
            async with asyncio.TaskGroup() as tg:
                task_progress = progress.add_task(
                    "[red]Pulling customers...", total=None
                )
                async for customer in customers:
                    task = tg.create_task(migrate_customer(customer))
                    task.add_done_callback(
                        lambda t: progress.update(task_progress, advance=1)
                    )
                    tasks.append(task)
                progress.update(task_progress, total=len(tasks))
                progress.start_task(task_progress)

            progress.stop_task(task_progress)
            insert_progress = progress.add_task(
                "[yellow]Inserting payment methods...", total=len(tasks)
            )
            progress.start_task(insert_progress)
            for task in tasks:
                methods = task.result()
                for method, _ in methods:
                    session.add(method)
                progress.update(insert_progress, advance=1)

            await session.flush()

            for task in tasks:
                methods = task.result()
                for method, default in methods:
                    if default:
                        await session.execute(
                            text("""
                                UPDATE customers
                                SET default_payment_method_id = :payment_method_id
                                WHERE id = :customer_id
                            """).bindparams(
                                payment_method_id=method.id,
                                customer_id=method.customer_id,
                            )
                        )

            await session.flush()

            progress.stop_task(insert_progress)
            update_progress = progress.add_task(
                "[red]Pulling subscriptions...", total=None
            )
            subscription_tasks: list[Task[tuple[UUID, UUID, str | None]]] = []
            async with asyncio.TaskGroup() as tg:
                async for subscription in subscriptions:
                    subscription_task = tg.create_task(
                        migrate_subscription(subscription)
                    )
                    subscription_task.add_done_callback(
                        lambda t: progress.update(update_progress, advance=1)
                    )
                    subscription_tasks.append(subscription_task)
                progress.update(update_progress, total=len(subscription_tasks))
                progress.start_task(update_progress)

            progress.stop_task(update_progress)
            update_progress = progress.add_task(
                "[yellow]Updating subscriptions with payment methods...",
                total=len(subscription_tasks),
            )
            progress.start_task(update_progress)
            for subscription_task in subscription_tasks:
                subscription_id, customer_id, processor_id = subscription_task.result()
                if processor_id is not None:
                    await session.execute(
                        text("""
                            UPDATE subscriptions
                            SET payment_method_id = (
                                SELECT id FROM payment_methods
                                WHERE processor = 'stripe'
                                AND processor_id = :processor_id
                                AND customer_id = :customer_id
                            )
                            WHERE id = :subscription_id
                        """).bindparams(
                            subscription_id=subscription_id,
                            customer_id=customer_id,
                            processor_id=processor_id,
                        )
                    )
                progress.update(update_progress, advance=1)

        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    cli()

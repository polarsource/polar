import asyncio
import logging.config
from functools import wraps
from typing import Any, TypedDict
from uuid import UUID

import dramatiq
import structlog
import typer
from rich.console import Console
from rich.progress import Progress
from rich.table import Table
from sqlalchemy import select

from polar import tasks  # noqa: F401
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Payment, Transaction
from polar.models.payment import PaymentStatus
from polar.models.transaction import TransactionType
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.payment.repository import PaymentRepository
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.worker import JobQueueManager

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


class RecoveryResult(TypedDict):
    order_id: UUID | None
    payment_id: UUID
    charge_id: str
    transaction_id: UUID | None


@cli.command()
@typer_async
async def order_balance_recovery(
    dry_run: bool = typer.Option(
        True, help="If True, only show what would be done without making changes"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with sessionmaker() as session:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            payment_repository = PaymentRepository.from_session(session)
            statement = (
                select(Payment)
                .where(
                    Payment.status == PaymentStatus.succeeded,
                    Payment.processor_id.not_in(
                        select(Transaction.charge_id).where(
                            Transaction.type == TransactionType.payment,
                            Transaction.charge_id.is_not(None),
                        )
                    ),
                )
                .order_by(Payment.created_at.asc())
            )
            with Progress() as progress:
                count = await payment_repository.count(statement)

                task = progress.add_task("Handling unbalanced payments", total=count)
                table = Table("Order", "Payment", "Charge", "Transaction")
                order_repository = OrderRepository.from_session(session)

                async for payment in payment_repository.stream(statement):
                    if payment.order_id is None:
                        table.add_row(None, str(payment.id), payment.processor_id, None)
                        progress.advance(task)
                        continue

                    charge = await stripe_service.get_charge(payment.processor_id)
                    transaction = await payment_transaction_service.create_payment(
                        session, charge=charge
                    )
                    order = await order_repository.get_by_id(
                        payment.order_id, options=order_repository.get_eager_options()
                    )
                    assert order is not None
                    await order_service.create_order_balance(session, order, charge.id)
                    table.add_row(
                        str(order.id),
                        str(payment.id),
                        str(payment.processor_id),
                        str(transaction.id),
                    )
                    progress.advance(task)
                    continue

            console = Console()
            console.print(table)

            if dry_run:
                await session.rollback()
                manager.reset()
                typer.echo("Dry run, no changes applied")
            else:
                await session.commit()
                await manager.flush(dramatiq.get_broker(), redis)


if __name__ == "__main__":
    cli()

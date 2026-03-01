import asyncio
import logging.config
from functools import wraps
from typing import Any
from uuid import UUID

import dramatiq
import structlog
import typer

from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Refund
from polar.models.refund import RefundReason, RefundStatus
from polar.order.repository import OrderRepository
from polar.payment.repository import PaymentRepository
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.refund.repository import RefundRepository
from polar.refund.service import refund as refund_service
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


@cli.command()
@typer_async
async def refunds_recovery(
    order_id: UUID = typer.Option(
        help="Order ID associated to refund",
    ),
    refund_id: UUID = typer.Option(help="Refund ID to recreate."),
    refund_processor_id: str = typer.Option(
        help="ID of the refund in the payment processor.",
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with sessionmaker() as session:
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.get_by_id(
                order_id, options=order_repository.get_eager_options()
            )
            if order is None:
                typer.echo(
                    typer.style(
                        f"Order with ID {order_id} not found.",
                        fg="red",
                    )
                )
                raise typer.Exit(1)

            payment_repository = PaymentRepository.from_session(session)
            payment = await payment_repository.get_succeeded_by_order(order.id)
            if payment is None:
                typer.echo(
                    typer.style(
                        f"Unknown payment for order with ID {order_id}.",
                        fg="red",
                    )
                )
                raise typer.Exit(1)

            stripe_refund = await stripe_service.get_refund(refund_processor_id)
            refund = Refund.from_stripe(stripe_refund, order, payment)
            refund.id = refund_id
            refund.reason = RefundReason.customer_request
            refund.comment = None
            refund.revoke_benefits = False
            refund.status = RefundStatus.pending

            refund_repository = RefundRepository.from_session(session)
            refund = await refund_repository.create(refund, flush=True)
            await refund_service._on_created(session, refund)
            await session.commit()


if __name__ == "__main__":
    cli()

import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer

from polar.integrations.stripe.payment import resolve_order
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
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
async def payment_transaction_recovery(
    charge_id: str = typer.Option(
        help="Charge ID to write to as payment transaction.",
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with sessionmaker() as session:
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            charge = await stripe_service.get_charge(charge_id)
            await payment_transaction_service.create_payment(session, charge=charge)

            order = await resolve_order(session, charge, None)
            if order is not None:
                enqueue_job("order.balance", order_id=order.id, charge_id=charge_id)

            await session.commit()


if __name__ == "__main__":
    cli()

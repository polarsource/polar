import asyncio
import logging.config
from functools import wraps
from typing import Any

import stripe as stripe_lib
import structlog
import typer

from polar import tasks  # noqa: F401
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.order.service import order as order_service
from polar.payment.service import payment as payment_service
from polar.postgres import create_async_engine
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)

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


semaphore = asyncio.Semaphore(48)


@cli.command()
@typer_async
async def missing_charge_invoice_fix(
    stripe_api_key: str, stripe_charge_id: str, stripe_invoice_id: str
) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # Create the charge
        charge = await stripe_service.get_charge(stripe_charge_id)
        await payment_service.upsert_from_stripe_charge(
            session, charge, None, None, None
        )
        await payment_transaction_service.create_payment(session, charge=charge)

        # Create the order
        invoice = await stripe_service.get_invoice(stripe_invoice_id)
        await order_service.create_order_from_stripe(session, invoice)
        await order_service.update_order_from_stripe(session, invoice)

        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    cli()

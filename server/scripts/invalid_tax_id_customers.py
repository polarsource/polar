import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer
from polar.postgres import create_async_engine
from polar.tax.tax_id import InvalidTaxID, validate_tax_id

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
async def invalid_tax_id_customers() -> None:
    """Find all non-deleted customers with an invalid tax ID."""
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        statement = select(Customer).where(Customer.deleted_at.is_(None))

        customers = await session.stream_scalars(statement)
        async for customer in customers:
            if customer.tax_id is None:
                continue
            tax_id_value, _tax_id_format = customer.tax_id
            billing_address = customer.billing_address

            if billing_address is None:
                typer.echo(
                    f"customer_id={customer.id} "
                    f"email={customer.email} "
                    f"tax_id={tax_id_value} "
                    f"reason=missing_billing_address"
                )
                continue

            try:
                validate_tax_id(tax_id_value, billing_address.country)
            except InvalidTaxID:
                typer.echo(
                    f"customer_id={customer.id} "
                    f"email={customer.email} "
                    f"tax_id={tax_id_value} "
                    f"country={billing_address.country} "
                    f"reason=invalid_tax_id"
                )


if __name__ == "__main__":
    cli()

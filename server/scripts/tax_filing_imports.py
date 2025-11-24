import asyncio
import csv
import logging.config
import pathlib
from functools import wraps
from typing import Annotated, Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import contains_eager

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Order, Organization, Product, Refund, Transaction
from polar.models.transaction import TransactionType
from polar.order.repository import OrderRepository
from polar.postgres import create_async_engine
from polar.product.repository import ProductRepository
from polar.transaction.repository import (
    TransactionRepository,
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


async def get_product_by_name(
    repository: ProductRepository, organization: Organization, name: str
) -> Any:
    statement = repository.get_base_statement().where(
        Product.organization_id == organization.id,
        func.lower(func.trim(Product.name)) == name.lower(),
    )
    return await repository.get_one_or_none(statement)


@cli.command()
@typer_async
async def tax_filing_import(
    file: Annotated[
        pathlib.Path,
        typer.Argument(
            exists=True,
            file_okay=True,
            dir_okay=False,
            writable=False,
            readable=True,
            resolve_path=True,
        ),
    ],
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        order_repository = OrderRepository.from_session(session)
        transaction_repository = TransactionRepository.from_session(session)

        customer_map: dict[str, Customer] = {}
        product_map: dict[str, Any] = {}

        # Count total rows
        with file.open("r") as f:
            total_rows = sum(1 for _ in csv.DictReader(f))

        with file.open("r") as f:
            reader = csv.DictReader(f)

            with Progress() as progress:
                task = progress.add_task(
                    "[green]Importing tax amounts...", total=total_rows
                )

                unmatching_transactions: set[str] = set()
                for row in reader:
                    reference_id = row["id"]
                    transaction_statement = (
                        select(Transaction)
                        .where(
                            Transaction.type.in_(
                                (TransactionType.payment, TransactionType.refund)
                            ),
                        )
                        .join(
                            Order,
                            and_(
                                Transaction.order_id == Order.id,
                                or_(
                                    Order.id == reference_id,
                                    Order.stripe_invoice_id == reference_id,
                                ),
                            ),
                            isouter=True,
                        )
                        .join(
                            Refund,
                            Transaction.polar_refund_id == reference_id,
                            isouter=True,
                        )
                        .options(
                            contains_eager(Transaction.order),
                            contains_eager(Transaction.refund),
                        )
                    )
                    transaction = await transaction_repository.get_one_or_none(
                        transaction_statement
                    )
                    if transaction is None:
                        unmatching_transactions.add(reference_id)
                        progress.advance(task)
                        continue

                    transaction.tax_processor_id = row["tax_transaction_id"]
                    transaction.tax_filing_currency = row["filing_currency"]
                    transaction.tax_filing_amount = int(
                        float(row["filing_total"]) * 100
                    )

                    progress.advance(task)

        if unmatching_transactions:
            print("The following transactions could not be matched to any order:")
            for transaction_id in unmatching_transactions:
                print(f"- {transaction_id}")

        await session.commit()


if __name__ == "__main__":
    cli()

import asyncio
import logging.config
import typing
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import CursorResult, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Transaction
from polar.models.transaction import TransactionType
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


@cli.command()
@typer_async
async def presentment_amount_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    total_updated = 0
    batch_number = 0

    print(f"Starting migration with batch_size={batch_size}, sleep={sleep_seconds}s")

    while True:
        async with sessionmaker() as session:
            # Subquery to select IDs that need updating
            subquery = (
                select(Transaction.id)
                .where(
                    Transaction.type.in_(
                        {
                            TransactionType.payment,
                            TransactionType.refund,
                            TransactionType.dispute,
                        }
                    ),
                    Transaction.presentment_currency.is_(None),
                    Transaction.presentment_amount.is_(None),
                    Transaction.presentment_tax_amount.is_(None),
                )
                .order_by(Transaction.id)
                .limit(batch_size)
                .scalar_subquery()
            )

            # Update using the subquery
            update_statement = (
                update(Transaction)
                .values(
                    presentment_currency=Transaction.currency,
                    presentment_amount=Transaction.amount,
                    presentment_tax_amount=Transaction.tax_amount,
                )
                .where(Transaction.id.in_(subquery))
            )

            result = await session.execute(update_statement)
            await session.commit()

            rows_updated = typing.cast(CursorResult[typing.Any], result).rowcount

            if rows_updated == 0:
                print("No more rows to update. Migration complete!")
                break

            batch_number += 1
            total_updated += rows_updated
            print(
                f"Batch {batch_number}: Updated {rows_updated} rows (total: {total_updated})"
            )

        # Sleep between batches to reduce load
        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)

    print(f"Migration complete! Total rows updated: {total_updated}")


if __name__ == "__main__":
    cli()

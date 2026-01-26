import asyncio
import datetime
import logging.config
from functools import wraps
from typing import Any

import stripe as stripe_lib
import structlog
import typer
from rich.progress import Progress
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import ProcessorTransaction
from polar.models.processor_transaction import Processor
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


def typer_async(f):
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def stripe_processor_transactions_import(stripe_api_key: str) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        with Progress() as progress:
            task = progress.add_task("Importing processor transactions", total=None)
            result = await stripe_lib.BalanceTransaction.list_async(limit=100)

            batch = []
            batch_size = 1000
            total_processed = 0

            async for bt in result.auto_paging_iter():
                # Convert Stripe BalanceTransaction to dict for insert directly
                transaction_data = {
                    "timestamp": datetime.datetime.fromtimestamp(
                        bt.created, tz=datetime.UTC
                    ),
                    "processor": Processor.stripe,
                    "processor_id": bt.id,
                    "type": bt.type,
                    "currency": bt.currency,
                    "amount": bt.amount,
                    "fee": bt.fee,
                    "description": bt.description,
                    "raw": bt,
                }

                batch.append(transaction_data)
                total_processed += 1

                # Process batch when it reaches batch_size
                if len(batch) >= batch_size:
                    stmt = insert(ProcessorTransaction).values(batch)
                    stmt = stmt.on_conflict_do_nothing(index_elements=["processor_id"])

                    await session.execute(stmt)
                    await session.flush()
                    batch = []

            # Process remaining items in the last batch
            if batch:
                stmt = insert(ProcessorTransaction).values(batch)
                stmt = stmt.on_conflict_do_nothing(index_elements=["processor_id"])

                await session.execute(stmt)
                await session.flush()
                progress.update(task, advance=len(batch))

            progress.stop_task(task)

            task = progress.add_task("Committing processor transactions", total=None)
            await session.commit()


if __name__ == "__main__":
    cli()

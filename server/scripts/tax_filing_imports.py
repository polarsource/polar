import asyncio
import csv
import logging.config
import pathlib
from collections import defaultdict
from decimal import Decimal
from functools import wraps
from itertools import batched
from typing import Annotated, Any
from uuid import UUID

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import contains_eager

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Order, Refund, Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine

cli = typer.Typer()

# Batch size - tune this based on your needs
# 500 is a good balance between query size and number of queries
BATCH_SIZE = 1000


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


def to_cents(amount: str) -> int:
    return int(Decimal(amount) * 100)


async def load_transactions_batch(
    session: Any,
    reference_ids: set[str],
) -> list[Transaction]:
    """Load transactions for a batch of reference IDs."""
    uuid_references: set[UUID] = set()
    str_references: set[str] = set()
    for ref in reference_ids:
        try:
            uuid_references.add(UUID(ref))
        except ValueError:
            str_references.add(ref)

    transaction_statement = (
        select(Transaction)
        .join(Order, Transaction.order_id == Order.id, isouter=True)
        .join(
            Refund,
            Transaction.refund_id == Refund.id,
            isouter=True,
        )
        .where(
            or_(
                and_(
                    Transaction.type == TransactionType.payment,
                    or_(
                        Order.id.in_(uuid_references),
                        Order.stripe_invoice_id.in_(str_references),
                    ),
                ),
                and_(
                    Transaction.type == TransactionType.refund,
                    or_(
                        Refund.id.in_(uuid_references),
                        Refund.processor_id.in_(str_references),
                    ),
                ),
            ),
        )
        .options(
            contains_eager(Transaction.order),
            contains_eager(Transaction.refund),
        )
    )

    result = await session.execute(transaction_statement)
    return result.unique().scalars().all()


def build_transaction_lookups(
    transactions: list[Transaction],
) -> tuple[dict[str, Transaction], dict[str, Transaction], dict[str, Transaction]]:
    """Build lookup dictionaries for fast transaction access."""
    transaction_by_order_id: dict[str, Transaction] = {}
    transaction_by_stripe_invoice_id: dict[str, Transaction] = {}
    transaction_by_refund_id: dict[str, Transaction] = {}

    for transaction in transactions:
        if transaction.type == TransactionType.payment and transaction.order:
            if transaction.order.id:
                transaction_by_order_id[str(transaction.order.id)] = transaction
            if transaction.order.stripe_invoice_id:
                transaction_by_stripe_invoice_id[
                    transaction.order.stripe_invoice_id
                ] = transaction
        elif transaction.type == TransactionType.refund and transaction.refund:
            if transaction.refund.id:
                transaction_by_refund_id[str(transaction.refund.id)] = transaction
            if transaction.refund.processor_id:
                transaction_by_refund_id[transaction.refund.processor_id] = transaction

    return (
        transaction_by_order_id,
        transaction_by_stripe_invoice_id,
        transaction_by_refund_id,
    )


def process_row(
    row: dict[str, Any],
    transaction: Transaction,
    pending_transactions: dict[str, list[dict[str, Any]]],
    session: AsyncSession,
) -> None:
    """Process a single CSV row and update the transaction."""
    reference_id = row["id"]

    transaction.tax_processor_id = row["tax_transaction_id"]
    transaction.tax_filing_currency = row["filing_currency"]
    transaction.tax_filing_amount = sum(
        to_cents(t["filing_tax_amount"]) for t in pending_transactions[reference_id]
    ) + to_cents(row["filing_tax_amount"])
    if transaction.tax_country is None:
        transaction.tax_country = row["country_code"]
    if transaction.tax_state is None:
        transaction.tax_state = row["state_code"]

    session.add(transaction)

    order = transaction.order
    if order is not None and order.tax_transaction_processor_id is None:
        order.tax_transaction_processor_id = row["tax_transaction_id"]
        session.add(order)

    refund = transaction.refund
    if refund is not None and refund.tax_transaction_processor_id is None:
        refund.tax_transaction_processor_id = row["tax_transaction_id"]
        session.add(refund)

    pending_transactions.pop(reference_id, None)


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
        unmatching_transactions: set[str] = set()
        pending_transactions: dict[str, list[dict[str, Any]]] = defaultdict(list)

        with Progress() as progress:
            # Step 1: Count rows
            count_task = progress.add_task("[cyan]Counting rows...", total=None)
            with file.open("rb") as f:
                total_rows = sum(1 for _ in f) - 1
            progress.update(count_task, completed=1, total=1)

            # Step 2: Load CSV
            load_task = progress.add_task("[cyan]Loading CSV...", total=None)
            with file.open("r") as f:
                reader = csv.DictReader(f)
                batches = list(batched(reader, BATCH_SIZE))
            progress.update(load_task, completed=1, total=1)

            # Step 3: Process batches
            process_task = progress.add_task(
                "[green]Processing tax amounts...", total=total_rows
            )

            for batch in batches:
                # Extract reference IDs from batch
                reference_ids = {row["id"] for row in batch}

                # Load transactions for this batch
                transactions = await load_transactions_batch(session, reference_ids)

                # Build lookups
                (
                    by_order_id,
                    by_stripe_invoice,
                    by_refund_id,
                ) = build_transaction_lookups(transactions)

                # Process each row in the batch
                for batch_row in batch:
                    reference_id = batch_row["id"]

                    total = to_cents(batch_row["total"])
                    if total == 0:
                        # No tax to import
                        continue

                    # Look up transaction
                    transaction = (
                        by_order_id.get(reference_id)
                        or by_stripe_invoice.get(reference_id)
                        or by_refund_id.get(reference_id)
                    )

                    if transaction is None:
                        unmatching_transactions.add(reference_id)
                        continue

                    row_tax_amount = to_cents(batch_row["tax_amount"]) + sum(
                        to_cents(t["tax_amount"])
                        for t in pending_transactions[reference_id]
                    )
                    if row_tax_amount != 0 and transaction.tax_amount != row_tax_amount:
                        pending_transactions[reference_id].append(batch_row)
                        continue

                    process_row(batch_row, transaction, pending_transactions, session)

                await session.commit()
                progress.update(process_task, advance=len(batch))

        if unmatching_transactions:
            print(
                f"\n⚠️  {len(unmatching_transactions)} transactions could not be matched:"
            )
            for transaction_id in sorted(unmatching_transactions):
                print(f"   - {transaction_id}")

        if pending_transactions:
            print(
                f"\n⚠️  {len(pending_transactions)} transactions have mismatching tax amounts:"
            )
            for transaction_id in sorted(pending_transactions.keys()):
                print(f"   - {transaction_id}")

        await session.commit()


if __name__ == "__main__":
    cli()

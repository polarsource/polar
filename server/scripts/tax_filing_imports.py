import asyncio
import csv
import logging.config
import pathlib
import tempfile
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from functools import wraps
from itertools import batched
from typing import Annotated, Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
import structlog
import typer
from rich.progress import Progress
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import contains_eager

from polar.kit.currency import _get_currency_decimal_factor
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Order, Refund, Transaction
from polar.models.transaction import TransactionType
from polar.postgres import create_async_engine

cli = typer.Typer()

# Batch size - tune this based on your needs
# 500 is a good balance between query size and number of queries
BATCH_SIZE = 750


def is_url(path: str) -> bool:
    """Check if the given path is a valid HTTP/HTTPS URL."""
    try:
        result = urlparse(path)
        return all([result.scheme in ("http", "https"), result.netloc])
    except ValueError:
        return False


@asynccontextmanager
async def resolve_file_path(file_input: str) -> AsyncIterator[pathlib.Path]:
    """Context manager that yields a local file path, downloading from URL if necessary."""
    if not is_url(file_input):
        path = pathlib.Path(file_input)
        if not path.exists():
            raise typer.BadParameter(f"File {file_input} does not exist")
        yield path
        return

    # Download URL to temp file
    temp_dir = tempfile.mkdtemp()
    temp_path = pathlib.Path(temp_dir) / "tax_filing_import.csv"

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", file_input) as response:
                response.raise_for_status()
                with open(temp_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
        yield temp_path
    finally:
        # Cleanup temp file and directory
        if temp_path.exists():
            temp_path.unlink()
        try:
            pathlib.Path(temp_dir).rmdir()
        except OSError:
            pass


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


def normalize(amount: str, currency: str) -> int:
    return int(Decimal(amount) * _get_currency_decimal_factor(currency))


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
        normalize(t["filing_tax_amount"], row["filing_currency"])
        for t in pending_transactions[reference_id]
    ) + normalize(row["filing_tax_amount"], row["filing_currency"])
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
        str,
        typer.Argument(),
    ],
) -> None:
    async with resolve_file_path(file) as local_path:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            unmatching_transactions: set[str] = set()
            pending_transactions: dict[str, list[dict[str, Any]]] = defaultdict(list)
            handled_transactions: set[str] = set()

            with Progress() as progress:
                # Step 1: Count rows
                count_task = progress.add_task("[cyan]Counting rows...", total=None)
                with local_path.open("rb") as f:
                    total_rows = sum(1 for _ in f) - 1
                progress.update(count_task, completed=1, total=1)

                # Step 2: Load CSV
                load_task = progress.add_task("[cyan]Loading CSV...", total=None)
                with local_path.open("r") as f:
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

                        # Case of zero tax amount transactions that are paired with a non-zero tax amount transaction in another row
                        # The transaction is already handled since the full amount is reconciled, since zero does not impact the tax amount, we can skip it
                        if reference_id in handled_transactions:
                            continue

                        total = normalize(batch_row["total"], batch_row["currency"])
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

                        row_tax_amount = normalize(
                            batch_row["tax_amount"], batch_row["currency"]
                        ) + sum(
                            normalize(t["tax_amount"], batch_row["currency"])
                            for t in pending_transactions[reference_id]
                        )
                        if transaction.presentment_tax_amount != row_tax_amount:
                            pending_transactions[reference_id].append(batch_row)
                            continue

                        process_row(
                            batch_row, transaction, pending_transactions, session
                        )
                        handled_transactions.add(reference_id)

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

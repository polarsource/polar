from typing import Literal

import typer
from sqlalchemy import select, update

from polar.enums import TaxProcessor
from polar.models import Checkout, Order, Transaction, WalletTransaction
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def tax_processor_backfill(
    entity: Literal[
        "checkout", "order", "wallet_transaction", "transaction"
    ] = typer.Argument(
        ...,
        help="Entity to backfill tax_processor for",
    ),
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    if entity == "checkout":
        await run_batched_update(
            (
                update(Checkout)
                .values(
                    tax_processor=TaxProcessor.stripe,
                )
                .where(
                    Checkout.id.in_(
                        select(Checkout.id)
                        .where(Checkout.tax_processor.is_(None))
                        .limit(limit_bindparam())
                    ),
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

    elif entity == "order":
        await run_batched_update(
            (
                update(Order)
                .values(
                    tax_processor=TaxProcessor.stripe,
                )
                .where(
                    Order.id.in_(
                        select(Order.id)
                        .where(
                            Order.tax_processor.is_(None),
                            Order.tax_transaction_processor_id.is_not(None),
                        )
                        .limit(limit_bindparam())
                    ),
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

    elif entity == "wallet_transaction":
        await run_batched_update(
            (
                update(WalletTransaction)
                .values(
                    tax_processor=TaxProcessor.stripe,
                )
                .where(
                    WalletTransaction.id.in_(
                        select(WalletTransaction.id)
                        .where(
                            WalletTransaction.tax_processor.is_(None),
                            WalletTransaction.tax_calculation_processor_id.is_not(None),
                        )
                        .limit(limit_bindparam())
                    ),
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

    elif entity == "transaction":
        await run_batched_update(
            (
                update(Transaction)
                .values(
                    tax_processor=TaxProcessor.stripe,
                )
                .where(
                    Transaction.id.in_(
                        select(Transaction.id)
                        .where(
                            Transaction.tax_processor.is_(None),
                            Transaction.tax_processor_id.is_not(None),
                        )
                        .limit(limit_bindparam())
                    ),
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )


if __name__ == "__main__":
    cli()

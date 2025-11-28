import typer
from sqlalchemy import select, update

from polar.models import Transaction
from polar.models.transaction import TransactionType
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

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
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Transaction)
    .values(
        presentment_currency=Transaction.currency,
        presentment_amount=Transaction.amount,
        presentment_tax_amount=Transaction.tax_amount,
    )
    .where(Transaction.id.in_(subquery))
)


@cli.command()
@typer_async
async def presentment_amount_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

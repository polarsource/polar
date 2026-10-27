"""Initialize customer credit-note counters after deploying the nullable column.

Run before deploying the NOT NULL migration:
    uv run python -m scripts.backfill_customer_credit_note_next_number
"""

import typer
from sqlalchemy import Update, select, update

from polar.models import Customer
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


def backfill_statement() -> Update:
    return (
        update(Customer)
        .where(
            Customer.id.in_(
                select(Customer.id)
                .where(Customer.credit_note_next_number.is_(None))
                .order_by(Customer.id)
                .limit(limit_bindparam())
            ),
            Customer.credit_note_next_number.is_(None),
        )
        .values(credit_note_next_number=1, modified_at=Customer.modified_at)
    )


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, min=1),
    sleep_seconds: float = typer.Option(0.1, min=0),
) -> None:
    await run_batched_update(
        backfill_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()

import typer
from sqlalchemy import select, update

from polar.models import Order
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
async def platform_fee_currency_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Order)
            .values(
                platform_fee_currency="usd",
            )
            .where(
                Order.id.in_(
                    select(Order.id)
                    .where(Order.platform_fee_currency.is_(None))
                    .order_by(Order.created_at.desc())
                    .limit(limit_bindparam())
                )
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

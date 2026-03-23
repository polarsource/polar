import typer
from sqlalchemy import func, select, update

from polar.models.discount import DiscountFixed
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
async def discount_amounts_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(DiscountFixed)
            .values(
                amounts=func.jsonb_build_object(
                    DiscountFixed.currency, DiscountFixed.amount
                )
            )
            .where(
                DiscountFixed.id.in_(
                    select(DiscountFixed.id)
                    .where(DiscountFixed.amounts.is_(None))
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

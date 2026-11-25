import typer
from sqlalchemy import func, select, update

from polar.models import Order
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)


@typer_async
async def backfill_order_payment_processor_metadata(
    batch_size: int = 5000,
    sleep_seconds: float = 0.1,
    execute: bool = typer.Option(False, help="Run the backfill (default: dry run)"),
) -> None:
    configure_script_logging()
    missing_metadata = Order.payment_processor_metadata.is_(None)
    if not execute:
        engine = create_async_engine("script")
        try:
            async with engine.connect() as connection:
                count = await connection.scalar(
                    select(func.count()).select_from(Order).where(missing_metadata)
                )
        finally:
            await engine.dispose()
        typer.echo(f"Dry run: {count} orders would be updated. Use --execute to apply.")
        return

    batch = (
        select(Order.id)
        .where(missing_metadata)
        .order_by(Order.id)
        .limit(limit_bindparam())
    )
    await run_batched_update(
        update(Order)
        .where(Order.id.in_(batch), missing_metadata)
        .values(payment_processor_metadata={}, modified_at=Order.modified_at),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    typer.run(backfill_order_payment_processor_metadata)

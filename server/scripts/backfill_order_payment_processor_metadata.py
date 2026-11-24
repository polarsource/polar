import asyncio

import typer
from sqlalchemy import select, update

from polar.models import Order
from scripts.helper import configure_script_logging, limit_bindparam, run_batched_update


def backfill_order_payment_processor_metadata(
    batch_size: int = 5000, sleep_seconds: float = 0.1
) -> None:
    configure_script_logging()
    batch = (
        select(Order.id)
        .where(Order.payment_processor_metadata.is_(None))
        .order_by(Order.id)
        .limit(limit_bindparam())
    )
    asyncio.run(
        run_batched_update(
            update(Order)
            .where(Order.id.in_(batch), Order.payment_processor_metadata.is_(None))
            .values(payment_processor_metadata={}, modified_at=Order.modified_at),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
    )


if __name__ == "__main__":
    typer.run(backfill_order_payment_processor_metadata)

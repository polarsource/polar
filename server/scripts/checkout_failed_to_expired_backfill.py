import typer
from sqlalchemy import select, update

from polar.models import Checkout
from polar.models.checkout import CheckoutStatus
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
async def checkout_failed_to_expired_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """
    Migrate deprecated `failed` checkouts to `expired`.

    The `failed` status is no longer assigned: when a payment fails the
    checkout is reset to `open` so the customer can retry. This backfill
    rewrites any remaining `failed` rows so the enum value can be removed.
    """
    subquery = (
        select(Checkout.id)
        .where(Checkout.status == CheckoutStatus.failed)
        .order_by(Checkout.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )

    update_statement = (
        update(Checkout)
        .values(status=CheckoutStatus.expired)
        .where(Checkout.id.in_(subquery))
    )

    await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

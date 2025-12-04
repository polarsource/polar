import typer
from sqlalchemy import select, update

from polar.models import Order, Payment
from polar.models.order import OrderBillingReason
from polar.models.payment import PaymentStatus
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
async def payment_order_link(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Payment)
            .values(
                order_id=Order.id,
            )
            .where(
                Payment.id.in_(
                    select(Payment.id)
                    .where(
                        Payment.status == PaymentStatus.succeeded,
                        Payment.checkout_id.is_not(None),
                        Payment.order_id.is_(None),
                    )
                    .limit(limit_bindparam())
                ),
                Payment.checkout_id == Order.checkout_id,
                Order.billing_reason.in_(
                    {
                        OrderBillingReason.purchase,
                        OrderBillingReason.subscription_create,
                    }
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

import structlog
import typer
from sqlalchemy import exists, select
from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Order, WalletTransaction
from polar.models.order import OrderStatus
from polar.postgres import create_async_engine
from polar.wallet.service import wallet as wallet_service
from scripts.helper import typer_async

log = structlog.get_logger()
cli = typer.Typer()


async def run_backfill(session: AsyncSession, *, dry_run: bool = True) -> int:
    """Restore wallet balance consumed by orders voided before the fix.

    An order that consumed customer wallet balance records it as a negative
    ``applied_balance_amount`` and debits the billing wallet at creation. Before
    polarsource/polar#13475, voiding such an order left that debit in place, so
    the customer permanently lost credit against an invoice that will never be
    collected.

    For every void order still missing its restoration, this creates the
    positive balance transaction the fixed ``void()`` now emits
    (``-applied_balance_amount``, tied to the order). It is idempotent: an order
    that already has a matching restoration transaction is skipped, so it is
    safe to re-run and won't double-credit orders voided after the fix.

    Returns the number of orders restored (or that would be restored on a dry
    run).
    """
    restoration_exists = (
        select(WalletTransaction.id)
        .where(
            WalletTransaction.order_id == Order.id,
            WalletTransaction.amount == -Order.applied_balance_amount,
        )
        .correlate(Order)
    )

    statement = (
        select(Order)
        .where(
            Order.status == OrderStatus.void,
            Order.applied_balance_amount < 0,
            ~exists(restoration_exists),
        )
        .options(joinedload(Order.customer))
        .order_by(Order.created_at)
    )

    orders = (await session.scalars(statement)).all()
    typer.echo(f"Found {len(orders)} void order(s) missing balance restoration.\n")

    total_amount = 0
    for order in orders:
        restore_amount = -order.applied_balance_amount
        typer.echo(
            f"  {order.id} customer={order.customer_id} "
            f"restore={restore_amount} {order.currency}"
        )
        total_amount += restore_amount

        if not dry_run:
            await wallet_service.create_balance_transaction(
                session,
                order.customer,
                restore_amount,
                order.currency,
                order=order,
            )

    if dry_run:
        typer.echo(
            f"\nDry run — would restore {total_amount} across {len(orders)} order(s). "
            f"Pass --no-dry-run to apply."
        )
    else:
        await session.commit()
        typer.echo(f"\nRestored {total_amount} across {len(orders)} order(s).")

    return len(orders)


@cli.command()
@typer_async
async def backfill(dry_run: bool = True) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            await run_backfill(session, dry_run=dry_run)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

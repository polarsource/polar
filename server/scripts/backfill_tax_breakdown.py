import asyncio
from functools import wraps

import typer
from sqlalchemy import case, func, select, update

from polar.models import (
    Checkout,
    Order,
    WalletTransaction,
)
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def backfill_orders(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Order)
            .values(
                tax_breakdown=func.jsonb_build_array(
                    func.jsonb_build_object(
                        "rate_type",
                        Order.tax_rate["rate_type"],
                        "rate",
                        case(
                            (
                                Order.tax_rate["basis_points"].is_not(None),
                                Order.tax_rate["basis_points"].as_float() / 10_000,
                            ),
                            else_=None,
                        ),
                        "display_name",
                        Order.tax_rate["display_name"],
                        "country",
                        Order.tax_rate["country"],
                        "state",
                        Order.tax_rate["state"],
                        "subdivision",
                        None,
                        "amount",
                        Order.tax_amount,
                        "taxability_reason",
                        Order.taxability_reason,
                    )
                )
            )
            .where(
                Order.id.in_(
                    select(Order.id)
                    .where(
                        Order.tax_breakdown.is_(None),
                        Order.tax_rate.is_not(None),
                        Order.taxability_reason.is_not(None),
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_checkouts(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:

    await run_batched_update(
        (
            update(Checkout)
            .values(
                tax_breakdown=func.jsonb_build_array(
                    func.jsonb_build_object(
                        "rate_type",
                        Checkout.tax_rate["rate_type"],
                        "rate",
                        case(
                            (
                                Checkout.tax_rate["basis_points"].is_not(None),
                                Checkout.tax_rate["basis_points"].as_float() / 10_000,
                            ),
                            else_=None,
                        ),
                        "display_name",
                        Checkout.tax_rate["display_name"],
                        "country",
                        Checkout.tax_rate["country"],
                        "state",
                        Checkout.tax_rate["state"],
                        "subdivision",
                        None,
                        "amount",
                        Checkout.tax_amount,
                        "taxability_reason",
                        Checkout.taxability_reason,
                    )
                )
            )
            .where(
                Checkout.id.in_(
                    select(Checkout.id)
                    .where(
                        Checkout.tax_breakdown.is_(None),
                        Checkout.tax_rate.is_not(None),
                        Checkout.taxability_reason.is_not(None),
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


async def backfill_wallet_transactions(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:

    await run_batched_update(
        (
            update(WalletTransaction)
            .values(
                tax_breakdown=func.jsonb_build_array(
                    func.jsonb_build_object(
                        "rate_type",
                        WalletTransaction.tax_rate["rate_type"],
                        "rate",
                        case(
                            (
                                WalletTransaction.tax_rate["basis_points"].is_not(None),
                                WalletTransaction.tax_rate["basis_points"].as_float()
                                / 10_000,
                            ),
                            else_=None,
                        ),
                        "display_name",
                        WalletTransaction.tax_rate["display_name"],
                        "country",
                        WalletTransaction.tax_rate["country"],
                        "state",
                        WalletTransaction.tax_rate["state"],
                        "subdivision",
                        None,
                        "amount",
                        WalletTransaction.tax_amount,
                        "taxability_reason",
                        WalletTransaction.taxability_reason,
                    )
                )
            )
            .where(
                WalletTransaction.id.in_(
                    select(WalletTransaction.id)
                    .where(
                        WalletTransaction.tax_breakdown.is_(None),
                        WalletTransaction.tax_rate.is_not(None),
                        WalletTransaction.taxability_reason.is_not(None),
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


@cli.command()
@typer_async
async def backfill_all(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    print("Backfilling orders...")
    await backfill_orders(batch_size, sleep_seconds)

    print("Backfilling checkouts...")
    await backfill_checkouts(batch_size, sleep_seconds)

    print("Backfilling wallet transactions...")
    await backfill_wallet_transactions(batch_size, sleep_seconds)

    print("All backfills completed!")


if __name__ == "__main__":
    cli()

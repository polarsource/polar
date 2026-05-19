import asyncio
from functools import wraps

import typer
from sqlalchemy import or_, select, update

from polar.config import settings
from polar.models import Account
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


@cli.command()
@typer_async
async def backfill_account_platform_fees(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(Account)
            .values(
                _platform_fee_percent=settings.PLATFORM_FEE_BASIS_POINTS,
                _platform_fee_fixed=settings.PLATFORM_FEE_FIXED,
            )
            .where(
                Account.id.in_(
                    select(Account.id)
                    .where(
                        or_(
                            Account._platform_fee_percent.is_(None),
                            Account._platform_fee_fixed.is_(None),
                        )
                    )
                    .limit(limit_bindparam())
                ),
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()

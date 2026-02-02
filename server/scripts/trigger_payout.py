import asyncio
import logging.config
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from pydantic import UUID4

from polar import tasks  # noqa: F401
from polar.account.repository import AccountRepository
from polar.kit.db.postgres import create_async_sessionmaker
from polar.locker import Locker
from polar.payout.service import payout as payout_service
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def trigger_payout(
    account_id: UUID4 = typer.Argument(..., help="Account ID to create payout for"),
) -> None:
    """Trigger a payout for the specified account ID."""
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")
    locker = Locker(redis)

    async with JobQueueManager.open(dramatiq.get_broker(), redis) as job_queue_manager:
        async with sessionmaker() as session:
            # Get account using repository directly
            account_repository = AccountRepository.from_session(session)
            account = await account_repository.get_by_id(account_id)

            if account is None:
                typer.echo(f"Error: Account with ID {account_id} not found", err=True)
                raise typer.Exit(1)

            typer.echo(f"Creating payout for account: {account.id}")
            typer.echo(f"   Account type: {account.account_type.value}")
            typer.echo(f"   Currency: {account.currency}")

            # Create the payout
            try:
                payout = await payout_service.create(session, locker, account=account)
                await session.commit()
                typer.echo(f"✅ Successfully created payout: {payout.id}")
                typer.echo(
                    f"   Gross Amount: {payout.amount / 100:.2f} {payout.currency}"
                )
                typer.echo(
                    f"   Fees Amount: {payout.fees_amount / 100:.2f} {payout.currency}"
                )
                typer.echo(
                    f"   Net Amount: {(payout.amount - payout.fees_amount) / 100:.2f} {payout.currency}"
                )
                typer.echo(f"   Status: {payout.status.value}")
                typer.echo(f"   Invoice Number: {payout.invoice_number}")
            except Exception as e:
                typer.echo(f"Error: Failed to create payout: {e}", err=True)
                raise typer.Exit(1)


if __name__ == "__main__":
    cli()

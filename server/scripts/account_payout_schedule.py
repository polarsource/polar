import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.enums import AccountType
from polar.integrations.stripe.service import stripe_lib  # type: ignore[attr-defined]
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Account
from polar.postgres import create_async_engine

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
async def account_payout_schedule() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        accounts_statement = select(Account).where(
            Account.account_type == AccountType.stripe
        )
        accounts = await session.stream_scalars(accounts_statement)
        async for account in accounts:
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling {account.id}")

            await stripe_lib.Account.modify_async(
                account.stripe_id,
                settings={"payouts": {"schedule": {"interval": "manual"}}},
            )


if __name__ == "__main__":
    cli()

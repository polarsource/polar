import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from pydantic import EmailError, EmailStr
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Pledge
from polar.models.pledge import PledgeState
from polar.postgres import create_engine
from polar.user.service import user as user_service

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
async def anonymous_pledge_migration(
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                join_transaction_mode="create_savepoint",
            )

            anonymous_pledges_statement = (
                select(Pledge)
                .where(
                    Pledge.by_user_id == None,  # noqa: E711
                    Pledge.state != PledgeState.initiated,
                )
                .order_by(Pledge.email, Pledge.created_at.asc())
            )
            anonymous_pledges = await session.stream_scalars(
                anonymous_pledges_statement
            )
            async for pledge in anonymous_pledges:
                user_email = pledge.email
                typer.echo("\n---\n")
                typer.echo(f"🔄 Handling Pledge {pledge.id} created by {user_email}")

                try:
                    EmailStr.validate(user_email)
                except EmailError:
                    typer.echo(
                        typer.style("\tInvalid email address. Skipping.", fg="red")
                    )
                    continue

                user = await user_service.get_by_email(session, user_email)
                if user is not None:
                    typer.echo(
                        typer.style(
                            (
                                "\t• User found with this email address. "
                                "Linking the pledge."
                            ),
                            fg="green",
                        )
                    )
                else:
                    user = await user_service.signup_by_email(session, user_email)
                    typer.echo(
                        typer.style(
                            (
                                "\t• Creating a new user with this email address. "
                                "Linking the pledge."
                            ),
                            fg="yellow",
                        )
                    )

                pledge.by_user_id = user.id
                session.add(pledge)

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


if __name__ == "__main__":
    cli()

import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from rich import print

from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.user.repository import UserRepository

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
async def user_session(
    email: str,
    user_agent: str = "script",
    scopes: list[Scope] = [Scope.web_read, Scope.web_read],
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_email(email)
        if user is None:
            print(f"[red]User with email {email} does not exist[/red]")
            raise typer.Exit(code=1)

        token, _ = await auth_service.create_user_session(
            session, user, user_agent=user_agent, scopes=scopes
        )
        print(token)
        await session.commit()


if __name__ == "__main__":
    cli()

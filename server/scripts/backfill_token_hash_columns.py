"""Copy every token hash into its wide column.

The new columns are filled on write from now on, so this only covers rows
written before that. Dry-run by default (counts only), pass --execute to write:

    uv run python -m scripts.backfill_token_hash_columns --execute
"""

import asyncio
from functools import wraps
from typing import Any

import typer
from sqlalchemy import func, select, update

from polar.config import settings
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.models import (
    CustomerSession,
    CustomerSessionCode,
    MemberSession,
    OAuth2Client,
    OrganizationAccessToken,
    PersonalAccessToken,
    UserSession,
)
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
)

cli = typer.Typer()

configure_script_logging()

COLUMNS: list[tuple[Any, str, str]] = [
    (UserSession, "token", "token_v2"),
    (CustomerSession, "token", "token_v2"),
    (MemberSession, "token", "token_v2"),
    (CustomerSessionCode, "code", "code_v2"),
    (PersonalAccessToken, "token", "token_v2"),
    (OrganizationAccessToken, "token", "token_v2"),
    (OAuth2Client, "client_secret_hash", "client_secret_hash_v2"),
    (
        OAuth2Client,
        "registration_access_token_hash",
        "registration_access_token_hash_v2",
    ),
]


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def backfill_token_hash_columns(
    execute: bool = typer.Option(False, "--execute", help="Write the columns"),
    batch_size: int = typer.Option(1000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    if not execute:
        engine = create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            pool_size=1,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        try:
            async with sessionmaker() as session:
                for model, old, new in COLUMNS:
                    pending = await session.scalar(
                        select(func.count())
                        .select_from(model)
                        .where(
                            getattr(model, new).is_(None),
                            getattr(model, old).is_not(None),
                        )
                    )
                    typer.echo(f"{model.__tablename__}.{new}: {pending} rows to fill")
        finally:
            await engine.dispose()
        typer.echo("Dry run, nothing written. Pass --execute to write.")
        return

    for model, old, new in COLUMNS:
        updated = await run_batched_update(
            (
                update(model)
                .values(
                    **{new: getattr(model, old)},
                    # Self-assign to suppress the onupdate: filling a column
                    # nobody reads yet must not make every row look modified.
                    modified_at=model.modified_at,
                )
                .where(
                    model.id.in_(
                        select(model.id)
                        .where(
                            getattr(model, new).is_(None),
                            getattr(model, old).is_not(None),
                        )
                        .order_by(model.id)
                        .limit(limit_bindparam())
                    )
                )
            ),
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
        typer.echo(f"{model.__tablename__}.{new}: {updated} rows filled")


if __name__ == "__main__":
    cli()

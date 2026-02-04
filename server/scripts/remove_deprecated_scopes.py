import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import text

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine

cli = typer.Typer()

DEPRECATED_SCOPES = [
    "external_organizations:read",
    "issues:read",
    "issues:write",
    "repositories:read",
    "repositories:write",
]

# Tables with a `scope` column (space-separated scopes)
SCOPE_TABLES = [
    "personal_access_tokens",
    "organization_access_tokens",
    "oauth2_tokens",
    "oauth2_grants",
]


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def run_cleanup(
    dry_run: bool = False,
    session: AsyncSession | None = None,
) -> None:
    """
    Remove deprecated scopes from all token tables.
    """
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    # Build regex pattern to match any deprecated scope
    # Pattern matches the scope optionally followed by a space
    scope_pattern = "(" + "|".join(DEPRECATED_SCOPES) + ") ?"

    try:
        typer.echo(f"Deprecated scopes to remove: {', '.join(DEPRECATED_SCOPES)}")
        typer.echo(f"Dry run: {dry_run}")
        typer.echo("")

        for table in SCOPE_TABLES:
            # Count affected rows
            count_query = text(f"""
                SELECT COUNT(*) FROM {table}
                WHERE scope ~ :pattern
            """)
            result = await session.execute(count_query, {"pattern": scope_pattern})
            affected_count = result.scalar_one()

            if affected_count == 0:
                typer.echo(f"{table}: no rows to update")
                continue

            typer.echo(f"{table}: {affected_count} rows to update")

            if not dry_run:
                # 1. Removes all deprecated scopes (with optional trailing space)
                # 2. Trims leading/trailing whitespace
                # 3. Collapses multiple spaces into one
                update_query = text(f"""
                    UPDATE {table}
                    SET scope = TRIM(REGEXP_REPLACE(
                        REGEXP_REPLACE(scope, :scope_pattern, '', 'g'),
                        ' +', ' ', 'g'
                    ))
                    WHERE scope ~ :scope_pattern
                """)
                await session.execute(
                    update_query,
                    {"scope_pattern": scope_pattern},
                )

        # Handle oauth2_clients.client_metadata (JSON field)
        metadata_count_query = text("""
            SELECT COUNT(*) FROM oauth2_clients
            WHERE client_metadata ~ :pattern
        """)
        result = await session.execute(metadata_count_query, {"pattern": scope_pattern})
        metadata_affected = result.scalar_one()

        if metadata_affected > 0:
            typer.echo(
                f"oauth2_clients (client_metadata): {metadata_affected} rows to update"
            )

            if not dry_run:
                # For JSON field, we do the same replacement
                metadata_update_query = text("""
                    UPDATE oauth2_clients
                    SET client_metadata = TRIM(REGEXP_REPLACE(
                        REGEXP_REPLACE(client_metadata, :scope_pattern, '', 'g'),
                        ' +', ' ', 'g'
                    ))
                    WHERE client_metadata ~ :scope_pattern
                """)
                await session.execute(
                    metadata_update_query,
                    {"scope_pattern": scope_pattern},
                )
        else:
            typer.echo("oauth2_clients (client_metadata): no rows to update")

        if not dry_run:
            await session.commit()
            typer.echo("")
            typer.echo("Done!")
        else:
            typer.echo("")
            typer.echo("Dry run complete. No changes were made.")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


@cli.command()
@typer_async
async def remove_deprecated_scopes(
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Show what would be updated without making changes"
    ),
) -> None:
    """
    Remove deprecated scopes from all token tables.

    This script removes the following deprecated scopes:
    - external_organizations:read
    - issues:read
    - issues:write
    - repositories:read
    - repositories:write
    """
    structlog.configure(processors=[drop_all])
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    await run_cleanup(dry_run=dry_run)


if __name__ == "__main__":
    cli()

"""Recompute OAuth2Client secret hashes under the current secret.

No lookup reads these two columns, so nothing migrates them. This script
recomputes them from the plaintext on the row.

Run once per rotation, after naming a new current secret and before retiring
the old one.

Dry-run by default (counts rows only). Pass --execute to write:

    uv run python -m scripts.rehash_oauth2_client_secrets --execute
"""

import asyncio

import typer
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from sqlalchemy import ColumnElement, Select, func, or_, select

from polar.config import HASH_SEPARATOR, settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import OAuth2Client

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _stale_clause() -> ColumnElement[bool]:
    prefix = f"{settings.CURRENT_HASH_SECRET_ID}{HASH_SEPARATOR}%"
    return or_(
        OAuth2Client.client_secret_hash.not_like(prefix),
        OAuth2Client.registration_access_token_hash.not_like(prefix),
    )


def _stale_batch(batch_size: int) -> Select[tuple[OAuth2Client]]:
    return (
        select(OAuth2Client)
        .where(_stale_clause())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )


def _rehash(client: OAuth2Client) -> None:
    if client.client_secret_hash is not None:
        client.client_secret_hash = OAuth2Client.hash_secret(client.client_secret)
    if client.registration_access_token_hash is not None:
        client.registration_access_token_hash = OAuth2Client.hash_secret(
            client.registration_access_token
        )


async def _count_remaining(session: AsyncSession) -> int:
    return (
        await session.scalar(
            select(func.count()).select_from(OAuth2Client).where(_stale_clause())
        )
        or 0
    )


async def run_rehash(
    batch_size: int = 50,
    sleep_seconds: float = 0.1,
    dry_run: bool = False,
    session: AsyncSession | None = None,
) -> int:
    """Rewrite stale OAuth2Client hashes under the current secret.

    HMAC has no SQL equivalent, so this loops in Python rather than issuing a
    set-based update. A rewritten row carries the current prefix and falls out
    of the predicate; the loop terminates and reruns are safe.
    """
    if settings.CURRENT_HASH_SECRET_ID is None:
        raise typer.BadParameter(
            "CURRENT_HASH_SECRET_ID is unset: there is no secret to rehash under"
        )

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

    total_rehashed = 0
    batch_number = 0

    try:
        if dry_run:
            count = await _count_remaining(session)
            typer.echo(f"[dry-run] {count} oauth2 clients would be rehashed")
            return count

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows rehashed", total=None)

            while True:
                result = await session.execute(_stale_batch(batch_size))
                clients = list(result.scalars().all())

                if not clients:
                    remaining = await _count_remaining(session)
                    if remaining > 0:
                        progress.update(
                            task,
                            description=(
                                f"[yellow]⚠ {total_rehashed} rehashed, {remaining} "
                                "skipped (locked) — rerun to finish"
                            ),
                        )
                    else:
                        progress.update(
                            task,
                            description=(
                                f"[green]✓ Complete: {total_rehashed} rows rehashed"
                            ),
                        )
                    break

                for client in clients:
                    _rehash(client)

                await session.commit()
                session.expunge_all()

                batch_number += 1
                total_rehashed += len(clients)
                progress.update(
                    task,
                    description=(
                        f"[cyan]Batch {batch_number}: {total_rehashed} rows rehashed"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

        return total_rehashed

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def rehash(
    batch_size: int = typer.Option(
        50, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    execute: bool = typer.Option(
        False, "--execute", help="Write the new hashes; without it, only counts rows"
    ),
) -> None:
    """Recompute OAuth2Client secret hashes under the current secret."""
    configure_script_logging()
    total_rehashed = await run_rehash(
        batch_size=batch_size, sleep_seconds=sleep_seconds, dry_run=not execute
    )
    if execute:
        typer.echo(f"Rehashed {total_rehashed} oauth2 clients")


if __name__ == "__main__":
    cli()

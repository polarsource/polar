"""Hash and encrypt legacy OAuth2Client secrets.

OAuth2Client uses a hybrid: a deterministic HMAC (``*_hash``) for synchronous
verification and value lookup, plus an envelope-encrypted copy (``*_encrypted``)
to reveal the plaintext. New rows dual-write both columns at write time; this
script fills them for rows created before that (which have plaintext only).

Dry-run by default (counts rows only). Pass --execute to write:

    uv run python -m scripts.backfill_oauth2_client_encrypted_secrets --execute
"""

import asyncio

import typer
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from sqlalchemy import func, or_, select
from sqlalchemy.sql.elements import ColumnElement

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import OAuth2Client

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _needs_backfill() -> ColumnElement[bool]:
    """A row still to backfill: any hash or ciphertext column is NULL. Both
    plaintext secrets are non-nullable, so a missing derived column is the only
    thing that qualifies a row."""
    return or_(
        OAuth2Client.client_secret_hash.is_(None),
        OAuth2Client.client_secret_encrypted.is_(None),
        OAuth2Client.registration_access_token_hash.is_(None),
        OAuth2Client.registration_access_token_encrypted.is_(None),
    )


async def run_backfill(
    batch_size: int = 500,
    sleep_seconds: float = 0.1,
    dry_run: bool = False,
    session: AsyncSession | None = None,
) -> int:
    """
    Hash and encrypt OAuth2Client secrets written before dual-write (rollout
    step for OAuth2Client; see the design document, Appendix C).

    Encryption calls the key provider once per secret, so this loops in Python
    rather than a set-based SQL update. Each backfilled secret fills its hash
    and ciphertext columns, so the row falls out of the predicate; the loop
    terminates and reruns are safe.
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

    total_encrypted = 0
    batch_number = 0

    try:
        if dry_run:
            count = (
                await session.scalar(
                    select(func.count())
                    .select_from(OAuth2Client)
                    .where(_needs_backfill())
                )
                or 0
            )
            typer.echo(f"[dry-run] {count} oauth2 clients would be encrypted")
            return count

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows encrypted", total=None)

            while True:
                # Lock the batch so a concurrent secret rotation can't be
                # overwritten with stale values; skip rows it holds, retry later.
                statement = (
                    select(OAuth2Client)
                    .where(_needs_backfill())
                    .order_by(OAuth2Client.id)
                    .limit(batch_size)
                    .with_for_update(skip_locked=True)
                )
                result = await session.execute(statement)
                clients = list(result.scalars().all())

                if not clients:
                    # An empty batch can also mean the rest are held by a
                    # concurrent rotation (skip_locked); say so instead of "done".
                    remaining = (
                        await session.scalar(
                            select(func.count())
                            .select_from(OAuth2Client)
                            .where(_needs_backfill())
                        )
                        or 0
                    )
                    if remaining > 0:
                        progress.update(
                            task,
                            description=(
                                f"[yellow]⚠ {total_encrypted} encrypted, {remaining} "
                                "skipped (locked) — rerun to finish"
                            ),
                        )
                    else:
                        progress.update(
                            task,
                            description=(
                                f"[green]✓ Complete: {total_encrypted} rows encrypted"
                            ),
                        )
                    break

                for client in clients:
                    if client.client_secret_hash is None:
                        client.client_secret_hash = OAuth2Client.hash_secret(
                            client.client_secret
                        )
                    if client.client_secret_encrypted is None:
                        client.client_secret_encrypted = (
                            await OAuth2Client.encrypt_client_secret(
                                client.id, client.client_secret
                            )
                        )
                    if client.registration_access_token_hash is None:
                        client.registration_access_token_hash = (
                            OAuth2Client.hash_secret(client.registration_access_token)
                        )
                    if client.registration_access_token_encrypted is None:
                        client.registration_access_token_encrypted = (
                            await OAuth2Client.encrypt_registration_access_token(
                                client.id, client.registration_access_token
                            )
                        )

                await session.commit()
                session.expunge_all()

                batch_number += 1
                total_encrypted += len(clients)
                progress.update(
                    task,
                    description=(
                        f"[cyan]Batch {batch_number}: {total_encrypted} rows encrypted"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

        return total_encrypted

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(
        500, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    execute: bool = typer.Option(
        False, "--execute", help="Write encrypted secrets; without it, only counts rows"
    ),
) -> None:
    """Hash and encrypt OAuth2Client secrets written before dual-write."""
    configure_script_logging()
    total_encrypted = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds, dry_run=not execute
    )
    if execute:
        typer.echo(f"Encrypted {total_encrypted} oauth2 clients")


if __name__ == "__main__":
    cli()

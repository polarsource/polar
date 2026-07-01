import asyncio

import typer
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from sqlalchemy import select

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import OAuthAccount

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def run_backfill(
    batch_size: int = 500,
    sleep_seconds: float = 0.1,
    session: AsyncSession | None = None,
) -> int:
    """
    Encrypt OAuthAccount tokens written before dual-write (rollout step 3; see
    the design document, Appendix C).

    Encryption calls the key provider once per row, so this loops in Python
    rather than a set-based SQL update. Encrypted rows fall out of the `IS NULL`
    predicate, so the loop terminates and reruns are safe.
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
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows encrypted", total=None)

            while True:
                statement = (
                    select(OAuthAccount)
                    .where(OAuthAccount.access_token_encrypted.is_(None))
                    .order_by(OAuthAccount.id)
                    .limit(batch_size)
                )
                result = await session.execute(statement)
                oauth_accounts = list(result.scalars().all())

                if not oauth_accounts:
                    progress.update(
                        task,
                        description=(
                            f"[green]✓ Complete: {total_encrypted} rows encrypted"
                        ),
                    )
                    break

                for oauth_account in oauth_accounts:
                    oauth_account.access_token_encrypted = (
                        await OAuthAccount.encrypt_access_token(
                            oauth_account.id, oauth_account.access_token
                        )
                    )
                    oauth_account.refresh_token_encrypted = (
                        await OAuthAccount.encrypt_refresh_token(
                            oauth_account.id, oauth_account.refresh_token
                        )
                    )

                await session.commit()
                session.expunge_all()

                batch_number += 1
                total_encrypted += len(oauth_accounts)
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
    batch_size: int = typer.Option(500, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Encrypt OAuthAccount tokens written before dual-write."""
    configure_script_logging()
    total_encrypted = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds
    )
    typer.echo(f"Encrypted {total_encrypted} oauth accounts")


if __name__ == "__main__":
    cli()

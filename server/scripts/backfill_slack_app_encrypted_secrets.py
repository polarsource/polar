import asyncio

import typer
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from sqlalchemy import and_, func, or_, select
from sqlalchemy.sql.elements import ColumnElement

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import SlackApp

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


def _needs_backfill() -> ColumnElement[bool]:
    """A row still to backfill: a plaintext secret exists but its ciphertext is
    NULL. Each secret is independent, so any of the three qualifies the row."""
    return or_(
        and_(
            SlackApp.client_secret.is_not(None),
            SlackApp.client_secret_encrypted.is_(None),
        ),
        and_(
            SlackApp.signing_secret.is_not(None),
            SlackApp.signing_secret_encrypted.is_(None),
        ),
        and_(
            SlackApp.bot_token.is_not(None),
            SlackApp.bot_token_encrypted.is_(None),
        ),
    )


async def run_backfill(
    batch_size: int = 500,
    sleep_seconds: float = 0.1,
    dry_run: bool = False,
    session: AsyncSession | None = None,
) -> int:
    """
    Encrypt SlackApp secrets written before dual-write (rollout step 3; see the
    design document, Appendix C).

    Encryption calls the key provider once per secret, so this loops in Python
    rather than a set-based SQL update. Each backfilled secret fills its
    ciphertext column, so the row falls out of the predicate; the loop
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
                    select(func.count()).select_from(SlackApp).where(_needs_backfill())
                )
                or 0
            )
            typer.echo(f"[dry-run] {count} slack apps would be encrypted")
            return count

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task("[cyan]Batch 0: 0 rows encrypted", total=None)

            while True:
                statement = (
                    select(SlackApp)
                    .where(_needs_backfill())
                    .order_by(SlackApp.id)
                    .limit(batch_size)
                )
                result = await session.execute(statement)
                slack_apps = list(result.scalars().all())

                if not slack_apps:
                    progress.update(
                        task,
                        description=(
                            f"[green]✓ Complete: {total_encrypted} rows encrypted"
                        ),
                    )
                    break

                for slack_app in slack_apps:
                    if (
                        slack_app.client_secret is not None
                        and slack_app.client_secret_encrypted is None
                    ):
                        slack_app.client_secret_encrypted = (
                            await SlackApp.encrypt_client_secret(
                                slack_app.id, slack_app.client_secret
                            )
                        )
                    if (
                        slack_app.signing_secret is not None
                        and slack_app.signing_secret_encrypted is None
                    ):
                        slack_app.signing_secret_encrypted = (
                            await SlackApp.encrypt_signing_secret(
                                slack_app.id, slack_app.signing_secret
                            )
                        )
                    if (
                        slack_app.bot_token is not None
                        and slack_app.bot_token_encrypted is None
                    ):
                        slack_app.bot_token_encrypted = (
                            await SlackApp.encrypt_bot_token(
                                slack_app.id, slack_app.bot_token
                            )
                        )

                await session.commit()
                session.expunge_all()

                batch_number += 1
                total_encrypted += len(slack_apps)
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
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Count rows that would be encrypted without writing"
    ),
) -> None:
    """Encrypt SlackApp secrets written before dual-write."""
    configure_script_logging()
    total_encrypted = await run_backfill(
        batch_size=batch_size, sleep_seconds=sleep_seconds, dry_run=dry_run
    )
    if not dry_run:
        typer.echo(f"Encrypted {total_encrypted} slack apps")


if __name__ == "__main__":
    cli()

"""Sync all users to Resend and save their contact IDs.

uv run python -m scripts.backfill_resend_id --concurrency 16
"""

import asyncio
from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import or_, select

from polar.config import settings
from polar.integrations.resend.service import resend as resend_service
from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.models import User
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


async def run_backfill(
    sessionmaker: AsyncSessionMaker,
    *,
    concurrency: int = 16,
) -> int:
    last_id: UUID | None = None
    total = 0
    semaphore = asyncio.Semaphore(concurrency)

    with Progress() as progress:
        task = progress.add_task("[cyan]Syncing users...", total=None)

        async def sync_user(user_id: UUID) -> None:
            nonlocal total
            try:
                async with sessionmaker.begin() as session:
                    await resend_service.sync_user(session, user_id)
                total += 1
                progress.advance(task)
            finally:
                semaphore.release()

        async with asyncio.TaskGroup() as group:
            while True:
                statement = (
                    select(User.id)
                    .where(or_(User.is_deleted, User.blocked_at.is_(None)))
                    .order_by(User.id)
                    .limit(1000)
                )
                if last_id is not None:
                    statement = statement.where(User.id > last_id)
                async with sessionmaker() as session:
                    user_ids = (await session.scalars(statement)).all()
                if not user_ids:
                    break

                for user_id in user_ids:
                    await semaphore.acquire()
                    group.create_task(sync_user(user_id))

                last_id = user_ids[-1]

    return total


@cli.command()
@typer_async
async def backfill(
    concurrency: int = typer.Option(
        16, min=1, help="Number of users to sync in parallel"
    ),
) -> None:
    configure_script_logging()
    if settings.RESEND_ACTIVE_USERS_SEGMENT_ID is None or not settings.RESEND_API_KEY:
        typer.echo(
            "RESEND_ACTIVE_USERS_SEGMENT_ID and RESEND_API_KEY must be configured."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        total = await run_backfill(sessionmaker, concurrency=concurrency)
        typer.echo(f"Done: {total} users synced.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

import asyncio
from uuid import UUID

import dramatiq
import typer
from rich.progress import Progress
from sqlalchemy import func, or_, select

from polar import tasks  # noqa: F401
from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import User
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@cli.command()
@typer_async
async def backfill() -> None:
    configure_script_logging()
    if settings.RESEND_ACTIVE_USERS_SEGMENT_ID is None or not settings.RESEND_API_KEY:
        typer.echo(
            "RESEND_ACTIVE_USERS_SEGMENT_ID and RESEND_API_KEY must be configured."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")

    try:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            with Progress() as progress:
                task_id = progress.add_task("[cyan]Enqueuing user sync...", total=None)

                statement = (
                    select(User.id)
                    .where(or_(User.is_deleted, User.blocked_at.is_(None)))
                    .order_by(User.id)
                )
                count_statement = statement.with_only_columns(func.count()).order_by(
                    None
                )
                async with sessionmaker() as session:
                    count_result = await session.execute(count_statement)
                progress.update(task_id, total=count_result.scalar_one())

                last_id: UUID | None = None
                while True:
                    page_statement = statement.limit(settings.DATABASE_STREAM_YIELD_PER)
                    if last_id is not None:
                        page_statement = page_statement.where(User.id > last_id)

                    async with sessionmaker() as session:
                        user_ids = (await session.scalars(page_statement)).all()

                    if not user_ids:
                        break

                    for user_id in user_ids:
                        enqueue_job("resend.sync_user", user_id)
                    progress.advance(task_id, len(user_ids))
                    last_id = user_ids[-1]

                    await manager.flush(dramatiq.get_broker(), redis)
                    if len(user_ids) < settings.DATABASE_STREAM_YIELD_PER:
                        break
                    await asyncio.sleep(1)
    finally:
        await engine.dispose()
        await redis.close()


if __name__ == "__main__":
    cli()

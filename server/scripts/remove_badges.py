import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from githubkit.exception import RequestFailed
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.integrations.github.client import get_app_installation_client
from polar.kit.db.postgres import AsyncSession
from polar.models import ExternalOrganization, Issue
from polar.models.external_organization import NotInstalledExternalOrganization
from polar.postgres import create_async_engine
from polar.redis import Redis, create_redis

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


semaphore = asyncio.Semaphore(48)


async def process_issue(
    session: AsyncSession,
    redis: Redis,
    issue: Issue,
) -> tuple[bool, str]:
    async with semaphore:
        external_org = issue.organization
        org = external_org.organization
        repo = issue.repository
        if org is not None:
            try:
                client = get_app_installation_client(
                    external_org.safe_installation_id, redis=redis
                )
                response = await client.rest.issues.async_remove_label(
                    external_org.name, repo.name, issue.number, repo.pledge_badge_label
                )
                labels = [
                    label.model_dump(mode="json") for label in response.parsed_data
                ]
                issue.labels = labels
                issue.has_pledge_badge_label = Issue.contains_pledge_badge_label(
                    labels, repo.pledge_badge_label
                )
                session.add(issue)
            except (RequestFailed, NotInstalledExternalOrganization):
                return False, str(issue.id)
        return True, str(issue.id)


@cli.command()
@typer_async
async def platform_fees_migration() -> None:
    engine = create_async_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            async with create_redis() as redis:
                session = AsyncSession(
                    bind=connection,
                    expire_on_commit=False,
                    join_transaction_mode="create_savepoint",
                )

                statement = (
                    select(Issue)
                    .where(Issue.pledge_badge_embedded_at.is_not(None))
                    .options(
                        joinedload(Issue.organization).joinedload(
                            ExternalOrganization.organization
                        ),
                        joinedload(Issue.repository),
                    )
                )
                stream = await session.stream(statement)

                tasks = []
                with Progress() as progress:
                    async with asyncio.TaskGroup() as tg:
                        progress_task = progress.add_task(
                            "[red]Processing orders...", total=None
                        )
                        async for issue in stream.scalars():
                            task = tg.create_task(process_issue(session, redis, issue))
                            task.add_done_callback(
                                lambda _: progress.update(progress_task, advance=1)
                            )
                            tasks.append(task)
                        progress.update(progress_task, total=len(tasks))
                        progress.start_task(progress_task)

                for task in tasks:
                    success, issue_id = task.result()
                    if not success:
                        typer.echo(f"Failed to process issue {issue_id}")

                await session.commit()


if __name__ == "__main__":
    cli()

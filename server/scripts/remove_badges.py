import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from arq.connections import create_pool as arq_create_pool
from githubkit.exception import RequestFailed
from rich.progress import Progress
from sqlalchemy import func, select

from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.client import get_app_installation_client
from polar.kit.db.postgres import AsyncSession
from polar.models import ExternalOrganization, Issue
from polar.models.external_organization import NotInstalledExternalOrganization
from polar.postgres import create_async_engine
from polar.redis import Redis
from polar.worker import QueueName, WorkerSettings, enqueue_job, flush_enqueued_jobs

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
                badge = GithubBadge(external_org, repo, issue, org)
                await badge.remove(redis)
                issue.pledge_badge_embedded_at = None
                session.add(issue)
                try:
                    client = get_app_installation_client(
                        external_org.safe_installation_id, redis=redis
                    )
                    response = await client.rest.issues.async_remove_label(
                        external_org.name,
                        repo.name,
                        issue.number,
                        repo.pledge_badge_label,
                    )
                except Exception:
                    pass
            except (RequestFailed, NotInstalledExternalOrganization):
                return False, str(issue.id)
        return True, str(issue.id)


@cli.command()
@typer_async
async def platform_fees_migration() -> None:
    engine = create_async_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            arq_pool = await arq_create_pool(WorkerSettings.redis_settings)
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )

            statement = (
                select(Issue.id)
                .join(Issue.organization)
                .where(
                    Issue.pledge_badge_embedded_at.is_not(None),
                    ExternalOrganization.installation_id.is_not(None),
                    ExternalOrganization.installation_suspended_at.is_(None),
                )
            )
            count_statement = statement.with_only_columns(func.count("*"))
            count_result = await session.execute(count_statement)
            count = count_result.scalar_one()

            stream = await session.stream(statement)

            with Progress() as progress:
                progress_task = progress.add_task(
                    "[red]Processing issues...", total=count
                )
                progress.start_task(progress_task)
                async for issue in stream.scalars():
                    enqueue_job(
                        "github.badge.remove_on_issue",
                        issue,
                        queue_name=QueueName.github_crawl,
                    )
                    progress.update(progress_task, advance=1)

            typer.echo("Flushing jobs...")
            await flush_enqueued_jobs(arq_pool)
            typer.echo("Jobs flushed")


if __name__ == "__main__":
    cli()

import asyncio
from collections.abc import Sequence
from functools import wraps

import typer
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.integrations.github.service import (
    github_organization,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import ExternalOrganization, Issue, Repository
from polar.postgres import AsyncSession, create_async_engine, sql
from polar.worker import QueueName, enqueue_job
from polar.worker import lifespan as worker_lifespan

cli = typer.Typer()

#
# This file contains scripts that are used in development.
#
# They are not allowed to be run in production.
#

###############################################################################
# Helpers
###############################################################################

engine = create_async_engine("script")
AsyncSessionLocal = create_async_sessionmaker(engine=engine)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def get_repositories(
    session: AsyncSession, org: ExternalOrganization
) -> Sequence[Repository]:
    query = sql.select(Repository).where(Repository.organization_id == org.id)
    res = await session.execute(query)
    return res.scalars().unique().all()


async def get_issues(
    session: AsyncSession, org: ExternalOrganization
) -> Sequence[Issue]:
    query = (
        sql.select(Issue)
        .options(joinedload(Issue.repository))
        .where(Issue.organization_id == org.id)
    )
    res = await session.execute(query)
    return res.scalars().unique().all()


async def do_delete_issues(session: AsyncSession, org: ExternalOrganization) -> None:
    query = sql.delete(Issue).where(Issue.organization_id == org.id)
    await session.execute(query)
    await session.commit()


async def trigger_issue_sync(
    session: AsyncSession, org: ExternalOrganization, repo: Repository, issue: Issue
) -> None:
    enqueue_job(
        "github.issue.sync",
        issue.id,
        queue_name=QueueName.github_crawl,
    )
    typer.echo(f"Triggered issue sync for {org.name}/{repo.name}/{issue.number}")


async def trigger_issues_sync(session: AsyncSession, org: ExternalOrganization) -> None:
    repositories = await get_repositories(session, org)
    if not repositories:
        raise RuntimeError(f"No repositories found for {org.name}")

    for repository in repositories:
        enqueue_job(
            "github.repo.sync.issues",
            org.id,
            repository.id,
            queue_name=QueueName.github_crawl,
        )
        enqueue_job(
            "github.repo.sync.pull_requests",
            org.id,
            repository.id,
            queue_name=QueueName.github_crawl,
        )
        typer.echo(f"Triggered issue sync for {org.name}/{repository.name}")


async def trigger_repositories_sync(
    session: AsyncSession, org: ExternalOrganization
) -> None:
    enqueue_job(
        "github.repo.sync.repositories",
        org.id,
        queue_name=QueueName.github_crawl,
    )
    typer.echo(f"Triggered repo sync for {org.name}")


###############################################################################
# Commands
###############################################################################


@cli.command()
def noop() -> None:
    # Just to avoid Typer fallback on running the only command as main
    # We want to be explicit about our commands/actions, i.e delete
    typer.echo("Noop")


@cli.command()
@typer_async
async def resync_issues(org_name: str) -> None:
    async with worker_lifespan():
        async with AsyncSessionLocal() as session:
            org = await github_organization.get_by_name(
                session, Platforms.github, org_name
            )
            if not org:
                raise RuntimeError(f"Organization {org_name} not found")

            await trigger_issues_sync(session, org)


@cli.command()
@typer_async
async def sync_repos(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        await trigger_repositories_sync(session, org)


@cli.command()
@typer_async
async def get_permissions(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")
        if not org.installation_id:
            raise RuntimeError(f"Organization {org_name} not installed")

        client = github.get_app_installation_client(org.installation_id)
        authed = await client.rest.apps.async_get_authenticated()
        print(str(authed.content))


if __name__ == "__main__":
    if not settings.is_development() or settings.is_testing():
        raise RuntimeError("DANGER! You cannot run this script in {settings.env}!")

    cli()

import asyncio
from functools import wraps
from typing import Sequence

import typer

from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github.service import github_organization
from polar.models import Issue, Organization, Repository
from polar.postgres import AsyncSession, AsyncSessionLocal, sql
from polar.worker import enqueue_job

cli = typer.Typer()

###############################################################################
# Helpers
###############################################################################


def typer_async(f):
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def get_repositories(
    session: AsyncSession, org: Organization
) -> Sequence[Repository]:
    query = sql.select(Repository).where(Repository.organization_id == org.id)
    res = await session.execute(query)
    return res.scalars().unique().all()


async def do_delete_issues(session: AsyncSession, org: Organization) -> None:
    query = sql.delete(Issue).where((Issue.organization_id == org.id))
    await session.execute(query)
    await session.commit()


async def trigger_issue_sync(session: AsyncSession, org: Organization) -> None:
    repositories = await get_repositories(session, org)
    if not repositories:
        raise RuntimeError(f"No repositories found for {org.name}")

    for repository in repositories:
        await enqueue_job("github.repo.sync.issues", org.id, repository.id)
        typer.echo(f"Triggered issue sync for {org.name}/{repository.name}")


async def trigger_issue_references_sync(
    session: AsyncSession, org: Organization
) -> None:
    repositories = await get_repositories(session, org)
    if not repositories:
        raise RuntimeError(f"No repositories found for {org.name}")

    for repository in repositories:
        await enqueue_job("github.repo.sync.issue_references", org.id, repository.id)
        typer.echo(f"Triggered issue references sync for {org.name}/{repository.name}")


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
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        await do_delete_issues(session, org)
        await trigger_issue_sync(session, org)


@cli.command()
@typer_async
async def sync_references(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        await trigger_issue_references_sync(session, org)


if __name__ == "__main__":
    if not settings.is_development() or settings.is_testing():
        raise RuntimeError("DANGER! You cannot run this script in {settings.env}!")

    cli()

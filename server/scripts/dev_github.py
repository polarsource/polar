import asyncio
from collections.abc import Sequence
from functools import wraps

import typer
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.integrations.github import service
from polar.integrations.github.service import (
    github_organization,
)
from polar.kit.db.postgres import create_sessionmaker
from polar.models import Issue, Organization, Repository
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import OrganizationCreate
from polar.postgres import AsyncSession, create_engine, sql
from polar.repository.schemas import RepositoryCreate
from polar.user.service import user as user_service
from polar.user_organization.service import user_organization
from polar.worker import enqueue_job
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

engine = create_engine("script")
AsyncSessionLocal = create_sessionmaker(engine=engine)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def get_repositories(
    session: AsyncSession, org: Organization
) -> Sequence[Repository]:
    query = sql.select(Repository).where(Repository.organization_id == org.id)
    res = await session.execute(query)
    return res.scalars().unique().all()


async def get_issues(session: AsyncSession, org: Organization) -> Sequence[Issue]:
    query = (
        sql.select(Issue)
        .options(joinedload(Issue.repository))
        .where(Issue.organization_id == org.id)
    )
    res = await session.execute(query)
    return res.scalars().unique().all()


async def do_delete_issues(session: AsyncSession, org: Organization) -> None:
    query = sql.delete(Issue).where(Issue.organization_id == org.id)
    await session.execute(query)
    await session.commit()


async def trigger_issue_sync(
    session: AsyncSession, org: Organization, repo: Repository, issue: Issue
) -> None:
    await enqueue_job("github.issue.sync", issue.id)
    typer.echo(f"Triggered issue sync for {org.name}/{repo.name}/{issue.number}")


async def trigger_issues_sync(session: AsyncSession, org: Organization) -> None:
    repositories = await get_repositories(session, org)
    if not repositories:
        raise RuntimeError(f"No repositories found for {org.name}")

    for repository in repositories:
        await enqueue_job("github.repo.sync.issues", org.id, repository.id)
        await enqueue_job("github.repo.sync.pull_requests", org.id, repository.id)
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


async def trigger_repositories_sync(session: AsyncSession, org: Organization) -> None:
    await enqueue_job("github.repo.sync.repositories", org.id)
    typer.echo(f"Triggered repo sync for {org.name}")


async def trigger_issue_dependencies_sync(
    session: AsyncSession, org: Organization
) -> None:
    issues = await get_issues(session, org)
    if not issues:
        raise RuntimeError(f"No issues found for {org.name}")

    for issue in issues:
        await enqueue_job("github.issue.sync.issue_dependencies", issue.id)
        typer.echo(
            f"Triggered issue dependencies sync for {org.name}/{issue.repository.name}/#{issue.number}"
        )


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
async def sync_references(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        await trigger_issue_references_sync(session, org)


@cli.command()
@typer_async
async def sync_dependencies(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        await trigger_issue_dependencies_sync(session, org)


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
async def add_external_repo(
    org_name: str, repo_name: str, invite_username: str
) -> None:
    async with AsyncSessionLocal() as session:
        """
        This command is very much a work in progress. Some tweaks are needed (like
        adjusting the installation ID) to get it to run.
        """
        client = github.get_app_installation_client(36355936)

        repo_response = await client.rest.repos.async_get(org_name, repo_name)
        github_repo = repo_response.parsed_data

        owner = github_repo.owner

        is_personal = owner.type.lower() == "user"
        org_schema = OrganizationCreate(
            platform=Platforms.github,
            name=owner.login,
            external_id=owner.id,
            avatar_url=owner.avatar_url,
            is_personal=is_personal,
        )
        organization = await service.github_organization.create_or_update(
            session, org_schema
        )

        repo_schema = RepositoryCreate(
            platform=Platforms.github,
            external_id=github_repo.id,
            organization_id=organization.id,
            name=github_repo.name,
            is_private=github_repo.private,
        )
        repository = await service.github_repository.create_or_update(
            session, repo_schema
        )

        user = await user_service.get_by(session, username=invite_username)
        if not user:
            print("user not found")
            return

        uc = await user_organization.get_by_user_and_org(
            session, user_id=user.id, organization_id=organization.id
        )
        if not uc:
            uc = UserOrganization(
                session=session,
                organization_id=organization.id,
                user_id=user.id,
            )
            session.add(uc)
            await session.commit()
            print("Added user to org", uc)

        # return

        # await enqueue_job(
        #    "github.issue.sync.issue_references",
        #    issue_id="ce38a42c-ca84-4e1c-a730-93218ca812e3",
        #    crawl_with_installation_id=36355936,
        # )

        if True:
            await enqueue_job(
                "github.repo.sync.issues",
                organization.id,
                repository.id,
                crawl_with_installation_id=36355936,
            )
            typer.echo(
                f"Triggered issue sync for {organization.name}/{repository.name}"
            )

        if False:
            await enqueue_job(
                "github.repo.sync.issue_references",
                organization.id,
                repository.id,
                crawl_with_installation_id=36355936,
            )
            typer.echo(
                f"Triggered issue_references {organization.name}/{repository.name}"
            )

        return

        # get

        # await trigger_repositories_sync(session, org)


if __name__ == "__main__":
    if not settings.is_development() or settings.is_testing():
        raise RuntimeError("DANGER! You cannot run this script in {settings.env}!")

    cli()

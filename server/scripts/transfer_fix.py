import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from githubkit import Response
from githubkit.exception import RequestError
from githubkit.rest import (
    InstallationRepositoriesGetResponse200,
)
from githubkit.rest import (
    Repository as GitHubRepository,
)
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.integrations.github.client import get_app_installation_client
from polar.integrations.github.service.issue import (
    github_issue as github_issue_service,
)
from polar.integrations.github.service.repository import (
    github_repository as github_repository_service,
)
from polar.kit.db.postgres import AsyncSession
from polar.models import Issue, Organization, Repository
from polar.postgres import create_engine

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


@cli.command()
@typer_async
async def organizations_renamed(
    organizations: list[str] | None = typer.Argument(None),
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                join_transaction_mode="create_savepoint",
            )

            installed_organizations_statement = (
                select(Organization)
                .where(
                    Organization.installation_id != None,  # noqa: E711
                )
                .order_by(Organization.created_at.asc())
            )
            if organizations:
                installed_organizations_statement = (
                    installed_organizations_statement.where(
                        Organization.name.in_(organizations)
                    )
                )
            installed_organizations = await session.stream_scalars(
                installed_organizations_statement
            )
            async for organization in installed_organizations:
                typer.echo("\n---\n")
                typer.echo(f"🔄 Handling Organization {organization.name}")

                client = get_app_installation_client(organization.safe_installation_id)

                try:
                    if organization.is_personal:
                        user_data = (
                            await client.rest.users.async_get_by_username(
                                str(organization.name)
                            )
                        ).parsed_data
                        login = user_data.login
                    else:
                        organization_data: dict[str, Any] = client.request(
                            "GET", f"/orgs/{organization.external_id}"
                        ).parsed_data
                        login = organization_data["login"]
                except RequestError:
                    typer.echo(typer.style("\tUnauthenticated app", fg="yellow"))
                    continue

                if login != organization.name:
                    typer.echo("\t Updating name: " f"{organization.name} ➡️ {login}")
                    organization.name = login
                    session.add(organization)

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


@cli.command()
@typer_async
async def repositories_transferred(
    organizations: list[str] | None = typer.Argument(None),
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                join_transaction_mode="create_savepoint",
            )

            installed_organizations_statement = (
                select(Organization)
                .where(
                    Organization.installation_id != None,  # noqa: E711
                )
                .order_by(Organization.created_at.asc())
            )
            if organizations:
                installed_organizations_statement = (
                    installed_organizations_statement.where(
                        Organization.name.in_(organizations)
                    )
                )
            installed_organizations = await session.stream_scalars(
                installed_organizations_statement
            )
            async for organization in installed_organizations:
                typer.echo("\n---\n")
                typer.echo(f"🔄 Handling Organization {organization.name}")

                client = get_app_installation_client(organization.safe_installation_id)

                def mapper(
                    res: Response[InstallationRepositoriesGetResponse200],
                ) -> list[GitHubRepository]:
                    return res.parsed_data.repositories

                try:
                    paginator = client.paginate(
                        client.rest.apps.async_list_repos_accessible_to_installation,
                        map_func=mapper,
                    )
                    async for repository_data in paginator:
                        repository = await github_repository_service.get_by_external_id(
                            session, repository_data.id
                        )
                        if repository is not None:
                            if repository.organization_id != organization.id:
                                typer.echo(
                                    typer.style(
                                        f"\tRe-link {repository.name} "
                                        f"to {organization.name}",
                                        fg="green",
                                    )
                                )
                                repository.organization = organization
                                repository.deleted_at = None
                                session.add(repository)

                except RequestError:
                    typer.echo(typer.style("\tUnauthenticated app", fg="yellow"))
                    continue

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


@cli.command()
@typer_async
async def issues_transferred(
    repositories: list[str] | None = typer.Argument(None),
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    engine = create_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                join_transaction_mode="create_savepoint",
            )

            issues_statement = (
                select(Issue)
                .join(Repository)
                .join(Organization)
                .where(
                    Issue.deleted_at == None,  # noqa: E711
                    Organization.installation_id != None,  # noqa: E711
                )
                .order_by(
                    Organization.id.asc(), Repository.id.asc(), Issue.created_at.asc()
                )
                .options(joinedload(Issue.repository), joinedload(Issue.organization))
            )
            if repositories:
                issues_statement = issues_statement.where(
                    Repository.name.in_(repositories)
                )
            issues = await session.stream_scalars(issues_statement)
            async for issue in issues:
                repository = issue.repository
                organization = issue.organization
                typer.echo("\n---\n")
                typer.echo(
                    "🔄 Handling Issue "
                    f"{organization.name}/{repository.name}/{issue.number}"
                )

                client = get_app_installation_client(organization.safe_installation_id)

                try:
                    issue_data = (
                        await client.rest.issues.async_get(
                            organization.name, repository.name, issue.number
                        )
                    ).parsed_data
                except RequestError:
                    typer.echo(typer.style("\tUnauthenticated app", fg="yellow"))
                    continue

                if issue_data.id != issue.external_id:
                    new_repository_data = client.request(
                        "GET",
                        issue_data.repository_url,
                        response_model=GitHubRepository,
                    ).parsed_data
                    if not new_repository_data:
                        typer.echo(
                            typer.style(
                                "\tIssue transferred, but no repository data",
                                fg="yellow",
                            )
                        )
                        continue

                    new_repository = (
                        await github_repository_service.create_or_update_from_github(
                            session, organization, new_repository_data
                        )
                    )
                    new_issue = await github_issue_service.create_or_update_from_github(
                        session, organization, new_repository, issue_data
                    )

                    new_issue = await github_issue_service.transfer(
                        session, issue, new_issue
                    )

                    await github_issue_service.soft_delete(session, issue.id)

                    typer.echo(
                        typer.style(
                            f"\tIssue transferred to {new_repository.name}",
                            fg="green",
                        )
                    )

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


if __name__ == "__main__":
    cli()

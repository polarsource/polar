import asyncio
from functools import wraps

import typer

from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.integrations.github.service import (
    github_issue,
    github_organization,
    github_repository,
)
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine

#
# This file contains scripts ready that are safe to run in production
#

cli = typer.Typer()

engine = create_async_engine("script")
AsyncSessionLocal = create_async_sessionmaker(engine=engine)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def delete_invalid_issues(org_name: str) -> None:
    async with AsyncSessionLocal() as session:
        org = await github_organization.get_by_name(session, Platforms.github, org_name)
        if not org:
            raise RuntimeError(f"Organization {org_name} not found")

        client = github.get_app_installation_client(org.safe_installation_id)

        repos = await github_repository.list_by(session, org_ids=[org.id])

        for repo in repos:
            typer.echo(f"Checking {repo.name}")

            issues = await github_issue.list_by_repository(session, repo.id)

            for i in issues:
                try:
                    gh_issue = await client.rest.issues.async_get(
                        owner=org.name, repo=repo.name, issue_number=i.number
                    )
                except Exception:
                    typer.echo(f"404, skipping #{i.number} - {i.title}")
                    continue

                if gh_issue.parsed_data.pull_request:
                    typer.echo(f"found pr, deleting! #{i.number} - {i.title}")
                    await github_issue.soft_delete(session, i.id)


if __name__ == "__main__":
    cli()

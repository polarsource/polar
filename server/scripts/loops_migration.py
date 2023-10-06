import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.config import settings
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.loops.client import LoopsClient, Properties
from polar.kit.db.postgres import create_sessionmaker
from polar.models import User, UserOrganization
from polar.pledge.service import pledge as pledge_service
from polar.postgres import create_engine
from polar.repository.service import repository as repository_service

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
async def loops_migration(
    dry_run: bool = typer.Option(
        False, help="If `True`, requests won't be truly sent to Loops."
    )
) -> None:
    loops_client = LoopsClient(settings.LOOPS_API_KEY if not dry_run else None)
    engine = create_engine()
    sessionmaker = create_sessionmaker(engine)
    async with sessionmaker() as session:
        users_statement = (
            select(User)
            .where(User.deleted_at == None)  # noqa: E711
            .order_by(User.created_at.asc())
        )
        result = await session.execute(users_statement)
        for user in result.unique().scalars():
            typer.echo("\n---\n")
            typer.echo(f"🔄 Handling User {user.email}")

            properties: Properties = {
                "isBacker": False,
                "isMaintainer": False,
                "organizationInstalled": False,
                "repositoryInstalled": False,
                "issueBadged": False,
            }

            user_organizations_statement = select(UserOrganization).where(
                UserOrganization.user_id == user.id
            )
            for user_organization in (
                (await session.execute(user_organizations_statement)).unique().scalars()
            ):
                properties["isMaintainer"] = True
                properties["organizationInstalled"] = True

                organization_repositories = await repository_service.list_by(
                    session, org_ids=[user_organization.organization_id]
                )
                for repository in organization_repositories:
                    properties["repositoryInstalled"] = True
                    issues = await github_issue_service.list_by_repository(
                        session, repository.id
                    )
                    for issue in issues:
                        if issue.pledge_badge_currently_embedded:
                            properties["issueBadged"] = True
                            break
                    if properties.get("issueBadged", False):
                        break
                if properties.get("repositoryInstalled", False):
                    break

            pledges = await pledge_service.list_by_pledging_user(
                session, user_id=user.id
            )
            if len(pledges) > 0:
                properties["isBacker"] = True

            typer.echo(properties)
            await loops_client.create_contact(
                user.email,
                str(user.id),
                **properties,
            )

        typer.echo("\n---\n")

        if dry_run:
            typer.echo(
                typer.style("Dry run, changes were not sent to Loops", fg="yellow")
            )


if __name__ == "__main__":
    cli()

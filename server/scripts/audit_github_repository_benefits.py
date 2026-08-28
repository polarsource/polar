from collections import defaultdict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast
from uuid import UUID

import typer
from githubkit.exception import GitHubException

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.github_repository.properties import (
    BenefitGitHubRepositoryProperties,
)
from polar.integrations.github import client as github
from polar.integrations.github_repository_benefit.service import (
    GitHubRepositoryInstallationError,
    github_repository_benefit_user_service,
)
from polar.kit.db.postgres import AsyncReadSession, create_async_sessionmaker
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

if TYPE_CHECKING:
    from githubkit.versions.latest.models import Collaborator

cli = typer.Typer()


@dataclass(frozen=True)
class RepositoryAccess:
    owner: str
    name: str
    benefit_ids: tuple[UUID, ...]
    granted_account_ids: frozenset[str]
    grants_without_account_id: int


@dataclass(frozen=True)
class GitHubCollaborator:
    id: int
    login: str


@dataclass(frozen=True)
class RepositoryAudit:
    access: RepositoryAccess
    collaborators: tuple[GitHubCollaborator, ...] = ()
    unexpected_collaborators: tuple[GitHubCollaborator, ...] = ()
    error: str | None = None


async def load_repository_access(
    session: AsyncReadSession, organization_id: UUID
) -> tuple[str, list[RepositoryAccess]] | None:
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(
        organization_id, include_blocked=True
    )
    if organization is None:
        return None

    benefit_repository = BenefitRepository.from_session(session)
    benefits = await benefit_repository.list_by_organization_and_type(
        organization.id, BenefitType.github_repository
    )

    benefits_by_repository: dict[tuple[str, str], list[Benefit]] = defaultdict(list)
    for benefit in benefits:
        properties = cast(BenefitGitHubRepositoryProperties, benefit.properties)
        key = (properties["repository_owner"], properties["repository_name"])
        benefits_by_repository[key].append(benefit)

    grant_repository = BenefitGrantRepository.from_session(session)
    repository_access: list[RepositoryAccess] = []
    for (owner, name), repository_benefits in sorted(benefits_by_repository.items()):
        granted_account_ids: set[str] = set()
        grants_without_account_id = 0
        for benefit in repository_benefits:
            grants = await grant_repository.list_granted_by_benefit(benefit)
            for grant in grants:
                account_id = grant.properties.get("granted_account_id")
                if isinstance(account_id, str):
                    granted_account_ids.add(account_id)
                else:
                    grants_without_account_id += 1

        repository_access.append(
            RepositoryAccess(
                owner=owner,
                name=name,
                benefit_ids=tuple(
                    sorted((benefit.id for benefit in repository_benefits), key=str)
                ),
                granted_account_ids=frozenset(granted_account_ids),
                grants_without_account_id=grants_without_account_id,
            )
        )

    return organization.slug, repository_access


async def fetch_collaborators(owner: str, name: str) -> list[GitHubCollaborator]:
    installation = (
        await github_repository_benefit_user_service.get_repository_installation(
            owner=owner, name=name
        )
    )
    collaborators: list[GitHubCollaborator] = []
    async with github.get_app_installation_client(installation.id) as client:
        async for collaborator in client.paginate(
            client.rest.repos.async_list_collaborators,
            owner=owner,
            repo=name,
            affiliation="all",
        ):
            collaborator = cast("Collaborator", collaborator)
            collaborators.append(
                GitHubCollaborator(id=collaborator.id, login=collaborator.login)
            )
    return collaborators


def find_unexpected_collaborators(
    collaborators: Sequence[GitHubCollaborator],
    granted_account_ids: frozenset[str],
) -> tuple[GitHubCollaborator, ...]:
    return tuple(
        collaborator
        for collaborator in collaborators
        if str(collaborator.id) not in granted_account_ids
    )


async def audit_repositories(
    repository_access: Sequence[RepositoryAccess],
    *,
    collaborator_fetcher: Callable[
        [str, str], Awaitable[list[GitHubCollaborator]]
    ] = fetch_collaborators,
) -> list[RepositoryAudit]:
    audits: list[RepositoryAudit] = []
    for access in repository_access:
        try:
            collaborators = await collaborator_fetcher(access.owner, access.name)
        except (GitHubException, GitHubRepositoryInstallationError) as error:
            audits.append(RepositoryAudit(access=access, error=str(error)))
            continue

        collaborators.sort(
            key=lambda collaborator: (collaborator.login, collaborator.id)
        )
        audits.append(
            RepositoryAudit(
                access=access,
                collaborators=tuple(collaborators),
                unexpected_collaborators=find_unexpected_collaborators(
                    collaborators, access.granted_account_ids
                ),
            )
        )
    return audits


def print_report(
    organization_slug: str,
    organization_id: UUID,
    audits: Sequence[RepositoryAudit],
) -> None:
    typer.echo(f"Organization: {organization_slug} ({organization_id})")
    typer.echo(f"Repositories: {len(audits)}")

    for audit in audits:
        access = audit.access
        typer.echo(f"\n{access.owner}/{access.name}")
        typer.echo(f"  Benefit IDs: {', '.join(map(str, access.benefit_ids))}")
        typer.echo(f"  Granted GitHub accounts: {len(access.granted_account_ids)}")
        if access.grants_without_account_id:
            typer.echo(
                "  WARNING: "
                f"{access.grants_without_account_id} active grant(s) have no "
                "granted_account_id"
            )

        if audit.error is not None:
            typer.echo(f"  ERROR: {audit.error}")
            continue

        typer.echo(f"  GitHub collaborators: {len(audit.collaborators)}")
        if not audit.unexpected_collaborators:
            typer.echo("  Unexpected collaborators: none")
            continue

        typer.echo("  Unexpected collaborators:")
        for collaborator in audit.unexpected_collaborators:
            typer.echo(
                f"    - {collaborator.login} (GitHub user ID: {collaborator.id})"
            )

    findings = sum(len(audit.unexpected_collaborators) for audit in audits)
    errors = sum(audit.error is not None for audit in audits)
    typer.echo(f"\nSummary: {findings} unexpected collaborator(s), {errors} error(s)")


@cli.command()
@typer_async
async def audit(
    organization_id: UUID = typer.Argument(..., help="Polar organization UUID"),
) -> None:
    """Audit GitHub collaborators against active repository benefit grants."""
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            loaded = await load_repository_access(session, organization_id)

        if loaded is None:
            typer.echo(f"Organization {organization_id} not found", err=True)
            raise typer.Exit(1)

        organization_slug, repository_access = loaded
        audits = await audit_repositories(repository_access)
        print_report(organization_slug, organization_id, audits)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()

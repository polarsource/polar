from datetime import datetime
from typing import Any, Tuple, Union
from uuid import UUID
from asyncpg import UniqueViolationError
from githubkit import GitHub
from githubkit.exception import RequestFailed

import structlog
from polar.exceptions import ResourceNotFound
from polar.issue.schemas import IssueCreate
from polar.kit.utils import utc_now

from polar.models import Organization, User
from polar.models.issue import Issue
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import OrganizationService
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.repository.schemas import RepositoryCreate

from .. import client as github
from .repository import github_repository
from .issue import github_issue

log = structlog.get_logger(service="GithubOrganizationService")


class GithubOrganizationService(OrganizationService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Organization | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def fetch_installations(
        self, session: AsyncSession, user: User
    ) -> list[OrganizationCreate] | None:
        oauth = user.get_platform_oauth_account(Platforms.github)
        if not oauth:
            # TODO Handle
            return None

        client = await github.get_user_client(session, user)
        response = (
            await client.rest.apps.async_list_installations_for_authenticated_user()
        )
        github.ensure_expected_response(response)

        installations = response.parsed_data.installations
        log.debug(
            "github.installations.fetch.success",
            user_id=user.id,
            installation_count=len(installations),
        )
        if not installations:
            return None

        return [OrganizationCreate.from_github_installation(i) for i in installations]

    async def install(
        self, session: AsyncSession, user: User, installation_id: int
    ) -> Organization | None:
        installations = await self.fetch_installations(session, user)
        if not installations:
            return None

        # Ideally, we could fetch the specific resource with /apps/installation/{id}
        # instead. However, Github only provides the installation_id and no verification
        # token. Therefore, using it would expose us to CSRF risks, e.g malicious user
        # guessing other installation IDs to get connected to them.
        filtered = [i for i in installations if i.installation_id == installation_id]
        if not filtered:
            return None

        to_create = filtered.pop()
        organization = await self.upsert(session, to_create)
        if not organization:
            return None

        # TODO: Better error handling?
        await self.add_user(session, organization, user, is_admin=True)
        await github_repository.install_for_organization(
            session, organization, installation_id
        )
        return organization

    async def suspend(
        self,
        session: AsyncSession,
        installation_id: int,
        suspended_by: int,
        suspended_at: datetime | None = None,
        external_user_id: int | None = None,
    ) -> bool:
        org = await self.get_by(session, installation_id=installation_id)
        if not org:
            return False

        if suspended_at is None:
            suspended_at = datetime.utcnow()

        # TODO: Return object instead?
        await org.update(
            session,
            installation_suspended_at=suspended_at,
            status=Organization.Status.SUSPENDED,
            installation_suspended_by=suspended_by,
            installation_suspender=external_user_id,
        )
        return True

    async def unsuspend(
        self,
        session: AsyncSession,
        installation_id: int,
        external_user_id: int | None = None,
    ) -> bool:
        org = await self.get_by(session, installation_id=installation_id)
        if not org:
            return False

        # TODO: Return object instead?
        await org.update(
            session,
            installation_suspended_at=None,
            status=Organization.Status.ACTIVE,
            installation_suspended_by=None,
            installation_suspender=external_user_id,
        )
        return True

    async def remove(self, session: AsyncSession, org_id: UUID) -> None:
        # mark all repositories as deleted
        repos = await github_repository.list_by_organization(session, org_id)
        for repo in repos:
            await github_repository.soft_delete(session, repo.id)

        await self.soft_delete(session, id=org_id)

    async def update_or_create_from_github(
        self,
        session: AsyncSession,
        installation: Union[
            github.rest.Installation,
            github.webhooks.Installation,
        ],
    ) -> Organization:
        account = installation.account
        if not account:
            raise Exception("installation has no account")
        if isinstance(account, github.rest.Enterprise):
            raise Exception("enterprise accounts is not supported")

        is_personal = account.type.lower() == "user"

        if isinstance(installation.created_at, int):
            installation.created_at = datetime.fromtimestamp(installation.created_at)

        if isinstance(installation.updated_at, int):
            installation.updated_at = datetime.fromtimestamp(installation.updated_at)

        org = await self.get_by_external_id(session, installation.id)
        if not org:
            create_schema = OrganizationCreate(
                platform=Platforms.github,
                name=account.login,
                external_id=account.id,
                avatar_url=account.avatar_url,
                is_personal=is_personal,
                installation_id=installation.id,
                installation_created_at=installation.created_at,
                installation_updated_at=installation.updated_at,
                installation_suspended_at=installation.suspended_at,
            )
            organization = await self.upsert(session, create_schema)
            return organization

        # update
        org.deleted_at = None
        org.name = account.login
        org.avatar_url = account.avatar_url
        org.installation_created_at = installation.created_at
        org.installation_updated_at = installation.updated_at
        org.installation_suspended_at = installation.suspended_at
        await org.save(session)

        return org

    async def sync_external_org_with_repo_and_issue(
        self,
        session: AsyncSession,
        *,
        client: GitHub[Any],
        org_name: str,
        repo_name: str,
        issue_number: int,
    ) -> Tuple[Organization, Repository, Issue]:
        organization = await self.get_by_name(session, Platforms.github, org_name)

        try:
            repo_response = await client.rest.repos.async_get(org_name, repo_name)
            github_repo = repo_response.parsed_data
            owner = github_repo.owner
            is_personal = owner.type.lower() == "user"

            if not organization:
                org_schema = OrganizationCreate(
                    platform=Platforms.github,
                    name=owner.login,
                    external_id=owner.id,
                    avatar_url=owner.avatar_url,
                    is_personal=is_personal,
                )
                organization = await self.create(session, org_schema)

            repository = await github_repository.get_by_external_id(
                session,
                external_id=github_repo.id,
            )
            if not repository:
                repo_schema = RepositoryCreate(
                    platform=Platforms.github,
                    external_id=github_repo.id,
                    organization_id=organization.id,
                    name=github_repo.name,
                    is_private=github_repo.private,
                )
                repository = await github_repository.create(session, repo_schema)

            issue = await github_issue.get_by_number(
                session,
                platform=Platforms.github,
                organization_id=organization.id,
                repository_id=repository.id,
                number=issue_number,
            )
            if not issue:
                issue_response = await client.rest.issues.async_get(
                    organization.name, repository.name, issue_number
                )
                github_issue_data = issue_response.parsed_data
                issue_schema = IssueCreate.from_github(
                    github_issue_data,
                    organization_id=organization.id,
                    repository_id=repository.id,
                )
                issue = await github_issue.create(session, issue_schema)

            return (organization, repository, issue)
        except RequestFailed as e:
            if e.response.status_code == 404:
                raise ResourceNotFound()
            # re-raise other status codes
            raise e


github_organization = GithubOrganizationService(Organization)

from datetime import datetime
from uuid import UUID

import structlog
from githubkit.rest.models import Installation as GitHubInstallation
from githubkit.rest.models import SimpleUser as GitHubSimpleUser
from githubkit.webhooks.models import Installation as GitHubWebhookInstallation
from githubkit.webhooks.models import User as GitHubUser

from polar.enums import Platforms
from polar.logging import Logger
from polar.models import Organization, User
from polar.organization.schemas import OrganizationCreate, OrganizationUpdate
from polar.organization.service import OrganizationService
from polar.postgres import AsyncSession

from .. import client as github
from .repository import github_repository

log: Logger = structlog.get_logger(service="GithubOrganizationService")


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

        organizations: list[OrganizationCreate] = []
        for installation in installations:
            account = installation.account
            if account is None:
                log.warning(
                    "installation without associated account",
                    installation_id=installation.id,
                )
                continue
            elif not isinstance(account, GitHubSimpleUser):
                log.warning(
                    "unsupported installation with an Enterprise account",
                    installation=installation.id,
                )
                continue
            organizations.append(
                OrganizationCreate.from_github(account, installation=installation)
            )

        return organizations

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
        organization = await self.create_or_update(session, to_create)
        if not organization:
            return None

        await self.populate_org_metadata(session, organization)

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

        org.installation_suspended_at = suspended_at
        org.status = Organization.Status.SUSPENDED
        org.installation_suspended_by = suspended_by

        # TODO: this never worked
        # org.installation_suspender = external_user_id

        await org.save(session)

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

        org.installation_suspended_at = None
        org.status = Organization.Status.ACTIVE
        org.installation_suspended_by = None

        # TODO: this never worked
        # org.installation_suspender=external_user_id
        await org.save(session)

        return True

    async def remove(self, session: AsyncSession, org_id: UUID) -> None:
        # mark all repositories as deleted
        repos = await github_repository.list_by(session, org_ids=[org_id])
        for repo in repos:
            await github_repository.soft_delete(session, repo.id)

        await self.soft_delete(session, id=org_id)

    async def create_or_update_from_github(
        self,
        session: AsyncSession,
        data: GitHubUser | GitHubSimpleUser,
        *,
        installation: GitHubInstallation | GitHubWebhookInstallation | None = None,
    ) -> Organization:
        organization = await self.get_by_external_id(session, data.id)

        if organization is None:
            log.debug(
                "organization not found by external_id, creating it",
                external_id=data.id,
            )
            organization = await self.create(
                session, OrganizationCreate.from_github(data, installation=installation)
            )
        else:
            log.debug(
                "organization found by external_id, updating it",
                external_id=data.id,
            )
            organization = await self.update(
                session,
                organization,
                OrganizationUpdate.from_github(data, installation=installation),
                exclude_unset=True,
            )

        return organization

    async def populate_org_metadata(
        self, session: AsyncSession, org: Organization
    ) -> None:
        if not org.installation_id:
            return None

        if org.is_personal:
            return await self._populate_github_user_metadata(session, org)

        return await self._populate_github_org_metadata(session, org)

    async def _populate_github_org_metadata(
        self, session: AsyncSession, org: Organization
    ) -> None:
        client = github.get_app_installation_client(org.safe_installation_id)
        github_org = client.rest.orgs.get(org.name)

        gh = github_org.parsed_data

        org.bio = gh.description
        org.pretty_name = gh.name if gh.name else None
        org.company = gh.company if gh.company else None
        org.blog = gh.blog if gh.blog else None
        org.location = gh.location if gh.location else None
        org.email = gh.email if gh.email else None
        org.twitter_username = gh.twitter_username if gh.twitter_username else None

        await org.save(session=session)

    async def _populate_github_user_metadata(
        self, session: AsyncSession, org: Organization
    ) -> None:
        client = github.get_app_installation_client(org.safe_installation_id)
        github_org = client.rest.users.get_by_username(org.name)

        gh = github_org.parsed_data

        org.bio = gh.bio
        org.pretty_name = gh.name
        org.company = gh.company
        org.blog = gh.blog
        org.location = gh.location
        org.email = gh.email
        org.twitter_username = gh.twitter_username if gh.twitter_username else None

        await org.save(session=session)


github_organization = GithubOrganizationService(Organization)

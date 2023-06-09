from datetime import datetime
from typing import Union
from uuid import UUID

import structlog
from polar.kit.utils import utc_now

from polar.models import Organization, User
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import OrganizationService
from polar.enums import Platforms
from polar.postgres import AsyncSession

from .. import client as github
from .repository import github_repository

log = structlog.get_logger()


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

    async def update_or_create_from_webhook(
        self,
        session: AsyncSession,
        event: Union[
            github.webhooks.InstallationRepositoriesAdded,
            github.webhooks.InstallationRepositoriesRemoved,
            github.webhooks.InstallationCreated,
        ],
    ) -> Organization:
        inst = event.installation
        account = event.installation.account
        is_personal = account.type.lower() == "user"

        if isinstance(event.installation.created_at, int):
            event.installation.created_at = datetime.fromtimestamp(
                event.installation.created_at
            )

        if isinstance(event.installation.updated_at, int):
            event.installation.updated_at = datetime.fromtimestamp(
                event.installation.updated_at
            )

        org = await self.get_by_external_id(session, inst.id)
        if not org:
            create_schema = OrganizationCreate(
                platform=Platforms.github,
                name=account.login,
                external_id=account.id,
                avatar_url=account.avatar_url,
                is_personal=is_personal,
                installation_id=event.installation.id,
                installation_created_at=utc_now(),
                installation_updated_at=utc_now(),
                installation_suspended_at=event.installation.suspended_at,
            )
            organization = await self.upsert(session, create_schema)
            return organization

        # update
        org.deleted_at = None
        org.name = account.login
        org.avatar_url = account.avatar_url
        await org.save(session)

        return org


github_organization = GithubOrganizationService(Organization)

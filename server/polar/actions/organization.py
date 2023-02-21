from datetime import datetime
from typing import Any, Sequence
from uuid import UUID

import structlog
from sqlalchemy import Column
from sqlalchemy.exc import IntegrityError

from polar.actions.base import Action
from polar.actions.repository import github_repository
from polar.clients import github
from polar.models import Organization, User, UserOrganization
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.organization import CreateOrganization, UpdateOrganization

log = structlog.get_logger()


class OrganizationActions(Action[Organization, CreateOrganization, UpdateOrganization]):
    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_name(
        self, session: AsyncSession, name: str
    ) -> Organization | None:
        return await self.get_by(session, name=name)

    async def get_all_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(UserOrganization.user_id == user_id)
        )
        res = await session.execute(statement)
        orgs = res.scalars().all()
        return orgs

    async def add_user(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id, organization_id=organization.id
            )
            session.add(relation)
            await session.commit()
            log.info(
                "organization.add_user",
                user_id=user.id,
                organization_id=organization.id,
            )
        except IntegrityError:
            # TODO: Currently, we treat this as success since the connection
            # exists. However, once we use status to distinguish active/inactive
            # installations we need to change this.
            log.info(
                "organization.add_user.already_exists",
                organization_id=organization.id,
                user_id=user.id,
            )
            await nested.rollback()


class GithubOrganization(OrganizationActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Organization | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def fetch_installations(
        self, session: AsyncSession, user: User
    ) -> list[CreateOrganization] | None:
        oauth = user.get_platform_oauth_account(Platforms.github)
        if not oauth:
            # TODO Handle
            return

        client = github.get_client(oauth.access_token)
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

        return [CreateOrganization.from_github_installation(i) for i in installations]

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
        await self.add_user(session, organization, user)
        repositories = await github_repository.install_for_organization(
            session, organization, installation_id
        )
        # TODO: Use SQLAlchemy features here vs. hard setter
        organization.repositories = repositories
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
        res = await org.update(
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
        res = await org.update(
            session,
            installation_suspended_at=None,
            status=Organization.Status.ACTIVE,
            installation_suspended_by=None,
            installation_suspender=external_user_id,
        )
        return True

    async def remove(
        self,
        session: AsyncSession,
        installation_id: int,
        external_user_id: int | None = None,
    ) -> bool:
        # TODO: Add security re: installation ownership?
        # TODO: Soft deletes at least OR even versioning
        return await self.delete(session, installation_id=installation_id)


organization = OrganizationActions(Organization)
github_organization = GithubOrganization(Organization)

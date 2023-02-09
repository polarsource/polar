from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.models.organization import Organization
from polar.platforms import Platforms
from polar.postgres import AsyncSession
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


class GithubOrganization(OrganizationActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Organization | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

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

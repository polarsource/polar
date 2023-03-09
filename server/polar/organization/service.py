from typing import Sequence
from uuid import UUID
from datetime import datetime, timezone

import structlog
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models import Organization, User, UserOrganization
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql

from .schemas import OrganizationCreate, OrganizationUpdate, OrganizationSettings

log = structlog.get_logger()


class OrganizationService(
    ResourceService[Organization, OrganizationCreate, OrganizationUpdate]
):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
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
        orgs = res.scalars().unique().all()
        return orgs

    async def get_all_org_repos_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .join(Organization.repos)
            .where(UserOrganization.user_id == user_id)
        )
        res = await session.execute(statement)
        orgs = res.scalars().unique().all()
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

    async def update_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationSettings,
    ) -> Organization:
        # Leverage .update() in case we expand this with additional settings
        organization.funding_badge_retroactive = settings.funding_badge_retroactive
        organization.funding_badge_show_amount = settings.funding_badge_show_amount
        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(timezone.utc)

        updated = await organization.save(session)
        log.info(
            "organization.update_settings",
            organization_id=organization.id,
            settings=settings.dict(),
        )
        return updated


organization = OrganizationService(Organization)

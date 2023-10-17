from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

import structlog
from sqlalchemy.exc import IntegrityError

from polar.enums import Platforms
from polar.integrations.loops.service import loops as loops_service
from polar.kit.services import ResourceService
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession, sql
from polar.repository.service import repository as repository_service

from .schemas import (
    OrganizationBadgeSettingsUpdate,
    OrganizationCreate,
    OrganizationGitHubUpdate,
    OrganizationUpdate,
)

log = structlog.get_logger()


class OrganizationService(
    ResourceService[Organization, OrganizationCreate, OrganizationGitHubUpdate]
):
    async def list_installed(self, session: AsyncSession) -> Sequence[Organization]:
        stmt = sql.select(Organization).where(
            Organization.deleted_at.is_(None),
            Organization.installation_id.is_not(None),
        )
        res = await session.execute(stmt)
        return res.scalars().all()

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_name(
        self, session: AsyncSession, platform: Platforms, name: str
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, name=name)

    async def list_all_orgs_by_user_id(
        self,
        session: AsyncSession,
        user_id: UUID,
        is_admin_only: bool,
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                Organization.deleted_at.is_(None),
            )
        )

        if is_admin_only:
            statement = statement.where(UserOrganization.is_admin.is_(True))

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        is_admin: bool,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                is_admin=is_admin,
            )
            session.add(relation)
            await nested.commit()
            await session.commit()
            log.info(
                "organization.add_user.created",
                user_id=user.id,
                organization_id=organization.id,
                is_admin=is_admin,
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

            # Update
            stmt = (
                sql.Update(UserOrganization)
                .where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.organization_id == organization.id,
                )
                .values(is_admin=is_admin)
            )
            await session.execute(stmt)
            await session.commit()
        finally:
            await loops_service.organization_installed(session, user=user)

    async def update_badge_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationBadgeSettingsUpdate,
    ) -> OrganizationBadgeSettingsUpdate:
        if settings.show_amount is not None:
            organization.pledge_badge_show_amount = settings.show_amount

        if settings.minimum_amount:
            organization.pledge_minimum_amount = settings.minimum_amount

        if settings.message:
            organization.default_badge_custom_content = settings.message

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(timezone.utc)

        await organization.save(session)

        # TODO: refactor this. the organization service should not depend
        # repositoriy service.
        #
        # We should try to keep the dependency graph the same in the services as
        # in the API schemas.
        repositories = await repository_service.list_by_ids_and_organization(
            session, [r.id for r in settings.repositories], organization.id
        )
        for repository_settings in settings.repositories:
            if repository := next(
                (r for r in repositories if r.id == repository_settings.id), None
            ):
                await repository_service.update_badge_settings(
                    session, organization, repository, repository_settings
                )

        log.info(
            "organization.update_badge_settings",
            organization_id=organization.id,
            settings=settings.dict(),
        )

        return settings

    async def update_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationUpdate,
    ) -> Organization:
        if settings.billing_email is not None:
            organization.billing_email = settings.billing_email

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(timezone.utc)

        if settings.set_default_upfront_split_to_contributors:
            organization.default_upfront_split_to_contributors = (
                settings.default_upfront_split_to_contributors
            )

        updated = await organization.save(session)
        log.info(
            "organization.update_settings",
            organization_id=organization.id,
            settings=settings.dict(),
        )

        return updated

    async def set_default_issue_badge_custom_message(
        self, session: AsyncSession, org: Organization, message: str
    ) -> Organization:
        stmt = (
            sql.update(Organization)
            .where(Organization.id == org.id)
            .values(default_badge_custom_content=message)
        )
        await session.execute(stmt)
        await session.commit()

        # update the in memory version as well
        org.default_badge_custom_content = message
        return org

    async def create_or_update(
        self, session: AsyncSession, r: OrganizationCreate
    ) -> Organization:
        update_keys = {
            "name",
            "avatar_url",
            "is_personal",
            "installation_id",
            "installation_created_at",
            "installation_updated_at",
            "installation_suspended_at",
            "status",
            "pledge_badge_show_amount",
            "pledge_minimum_amount",
            "deleted_at",
        }

        insert_stmt = sql.insert(Organization).values(**r.dict())

        stmt = (
            insert_stmt.on_conflict_do_update(
                index_elements=[Organization.external_id],
                set_={k: getattr(insert_stmt.excluded, k) for k in update_keys},
            )
            .returning(Organization)
            .execution_options(populate_existing=True)
        )

        res = await session.execute(stmt)
        await session.commit()
        return res.scalars().one()


organization = OrganizationService(Organization)

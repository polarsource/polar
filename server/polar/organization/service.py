from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

import structlog
from sqlalchemy import ColumnElement, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, contains_eager

from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.issue.service import issue as issue_service
from polar.kit.services import ResourceService
from polar.models import Issue, Organization, Repository, User, UserOrganization
from polar.postgres import AsyncSession, sql
from polar.repository.service import repository as repository_service

from .schemas import (
    OrganizationBadgeSettingsUpdate,
    OrganizationCreate,
    OrganizationSettingsUpdate,
    OrganizationUpdate,
)

log = structlog.get_logger()


class OrganizationService(
    ResourceService[Organization, OrganizationCreate, OrganizationUpdate]
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
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                Organization.deleted_at.is_(None),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def get_all_org_repos_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Organization]:
        statement = (
            sql.select(Organization)
            .join(UserOrganization)
            .join(Organization.repos)
            .options(contains_eager(Organization.repos))
            .where(
                UserOrganization.user_id == user_id,
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def _get_protected(
        self,
        session: AsyncSession,
        *,
        platform: Platforms | None = None,
        org_name: str | None = None,
        org_id: UUID | None = None,
        repo_name: str | None = None,
        user_id: UUID | None = None,
    ) -> Organization | None:
        if not user_id and not repo_name:
            raise ValueError(
                "Must provide at least one relationship (user_id or repo_name)"
            )

        if not org_id and not org_name:
            raise ValueError(
                "Must provide at least one relationship (org_id or org_name)"
            )

        if org_name and not platform:
            raise ValueError("If org_name is set platform must be provided")

        query = sql.select(Organization)
        filters: list[ColumnElement[bool]] = [
            Organization.deleted_at.is_(None),
        ]

        if platform:
            filters.append(Organization.platform == platform)

        if org_id:
            filters.append(Organization.id == org_id)
        if org_name:
            filters.append(Organization.name == org_name)

        if user_id:
            query = query.join(UserOrganization)
            filters.append(UserOrganization.user_id == user_id)

        if repo_name:
            query = query.join(Organization.repos)
            # Need to do contains_eager to load a custom filtered collection of repo
            query = query.options(contains_eager(Organization.repos))
            filters.append(Repository.name == repo_name)
            filters.append(Repository.deleted_at.is_(None))

        query = query.where(and_(*filters))
        res = await session.execute(query)
        return org if (org := res.scalars().unique().first()) else None

    async def get_for_user(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str,
        user_id: UUID | None = None,
    ) -> Organization | None:
        org = await self._get_protected(
            session,
            platform=platform,
            org_name=org_name,
            user_id=user_id,
        )
        return org or None

    async def get_by_id_for_user(
        self,
        session: AsyncSession,
        *,
        org_id: UUID,
        user_id: UUID,
    ) -> Organization | None:
        org = await self._get_protected(
            session,
            org_id=org_id,
            user_id=user_id,
        )
        return org or None

    async def get_with_repo_for_user(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str,
        user_id: UUID,
    ) -> tuple[Organization, Repository]:
        org = await self._get_protected(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            user_id=user_id,
        )
        if not org:
            raise ResourceNotFound(
                "Organization/repository combination not found for user"
            )

        # Return a tuple of (org, repo) for intuititive usage (unpacking)
        # versus having to do org.repos[0] in the caller.
        return (org, org.repos[0])

    async def get_with_repo(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str,
    ) -> tuple[Organization, Repository]:
        org = await self._get_protected(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
        )
        if not org:
            raise ResourceNotFound()

        # Return a tuple of (org, repo) for intuititive usage (unpacking)
        # versus having to do org.repos[0] in the caller.
        return (org, org.repos[0])

    async def get_with_repo_and_issue(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str,
        issue: int | UUID,
    ) -> tuple[Organization, Repository, Issue]:
        org_and_repo = await self.get_with_repo(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
        )
        if not org_and_repo:
            raise ResourceNotFound("Organization and repo combination not found")

        organization, repository = org_and_repo
        if isinstance(issue, int):
            issue_obj = await issue_service.get_by_number(
                session,
                platform=platform,
                organization_id=organization.id,
                repository_id=repository.id,
                number=issue,
            )
        else:
            issue_obj = await issue_service.get(
                session,
                id=issue,
            )
        if not issue_obj:
            raise ResourceNotFound("Issue not found")

        return (organization, repository, issue_obj)

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
            return
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
        settings: OrganizationSettingsUpdate,
    ) -> Organization:
        # Leverage .update() in case we expand this with additional settings

        if settings.billing_email is not None:
            organization.billing_email = settings.billing_email

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(timezone.utc)

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

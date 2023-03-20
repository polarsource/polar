from typing import Sequence
from uuid import UUID
from datetime import datetime, timezone

import structlog
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, contains_eager

from polar.kit.services import ResourceService
from polar.exceptions import ResourceNotFound
from polar.models import Organization, User, UserOrganization, Repository, Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql
from polar.issue.service import issue as issue_service

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
        self, session: AsyncSession, platform: Platforms, name: str
    ) -> Organization | None:
        return await self.get_by(session, platform=platform, name=name)

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

    async def _get_protected(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str | None = None,
        user_id: UUID | None = None,
    ) -> Organization | None:
        if not (user_id or repo_name):
            raise ValueError(
                "Must provide at least one relationship (user_id or repo_name)"
            )

        query = sql.select(Organization)
        filters = [
            Organization.platform == platform,
            Organization.name == org_name,
        ]

        if user_id:
            query = query.join(UserOrganization)
            filters.append(UserOrganization.user_id == user_id)

        if repo_name:
            query = query.join(Organization.repos)
            # Need to do contains_eager to load a custom filtered collection of repo
            query = query.options(contains_eager(Organization.repos))
            filters.append(Repository.name == repo_name)

        query = query.where(and_(*filters))
        res = await session.execute(query)
        org = res.scalars().unique().first()
        if org:
            return org
        return None

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
        if not org:
            return None
        return org

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
            raise ResourceNotFound()

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
            raise ResourceNotFound()

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
            issue_obj = await issue_service.get_by_id(
                session,
                platform=platform,
                organization_id=organization.id,
                repository_id=repository.id,
                id=issue,
            )
        if not issue_obj:
            raise ResourceNotFound()

        return (organization, repository, issue_obj)

    async def add_user(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id, organization_id=organization.id
            )
            session.add(relation)
            await nested.commit()
            log.info(
                "organization.add_user",
                user_id=user.id,
                organization_id=organization.id,
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

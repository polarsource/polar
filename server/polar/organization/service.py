from typing import Sequence
from uuid import UUID
from datetime import datetime, timezone

import structlog
from sqlalchemy import and_, or_, distinct
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    InstrumentedAttribute,
    contains_eager,
)

from polar.kit.services import ResourceService
from polar.exceptions import ResourceNotFound
from polar.models import Organization, User, UserOrganization, Repository, Issue
from polar.enums import Platforms
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession, sql
from polar.issue.service import issue as issue_service
from polar.repository.service import repository as repository_service
from polar.worker import enqueue_job

from .schemas import (
    OrganizationCreate,
    OrganizationSettingsUpdate,
    OrganizationUpdate,
    RepositoryBadgeSettingsRead,
    OrganizationBadgeSettingsRead,
    OrganizationBadgeSettingsUpdate,
)

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
            .options(contains_eager(Organization.repos))
            .where(
                UserOrganization.user_id == user_id,
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
            )
        )
        res = await session.execute(statement)
        orgs = res.scalars().unique().all()
        return orgs

    async def _get_protected(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_name: str | None = None,
        org_id: UUID | None = None,
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
            Organization.deleted_at.is_(None),
        ]

        if not (org_id or org_name):
            raise ValueError(
                "Must provide at least one relationship (org_id or org_name)"
            )

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

    async def get_by_id_for_user(
        self,
        session: AsyncSession,
        *,
        platform: Platforms,
        org_id: UUID,
        user_id: UUID,
    ) -> Organization | None:
        org = await self._get_protected(
            session,
            platform=platform,
            org_id=org_id,
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
                id=issue,
            )
        if not issue_obj:
            raise ResourceNotFound()

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

    async def get_badge_settings(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> OrganizationBadgeSettingsRead:
        repositories = await repository_service.list_by_organization(
            session, organization.id, order_by_open_source=True
        )

        synced = await self.get_repositories_synced_count(session, organization)

        repos = []
        for repo in repositories:
            open_issues = repo.open_issues or 0
            synced_issues = synced.get(repo.id, 0)
            if synced_issues > open_issues:
                open_issues = synced_issues

            is_sync_completed = synced_issues == open_issues

            repos.append(
                RepositoryBadgeSettingsRead(
                    id=repo.id,
                    avatar_url=organization.avatar_url,
                    badge_enabled=repo.pledge_badge,
                    name=repo.name,
                    synced_issues=synced_issues,
                    open_issues=open_issues,
                    is_private=repo.is_private,
                    is_sync_completed=is_sync_completed,
                )
            )

        return OrganizationBadgeSettingsRead(
            show_amount=organization.pledge_badge_show_amount,
            repositories=repos,
        )

    async def update_badge_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationBadgeSettingsUpdate,
    ) -> OrganizationBadgeSettingsUpdate:
        if settings.show_amount is not None:
            organization.pledge_badge_show_amount = settings.show_amount

        repositories = await repository_service.list_by_ids_and_organization(
            session, [r.id for r in settings.repositories], organization.id)
        for repository_settings in settings.repositories:
            repository = next((r for r in repositories
                               if r.id == repository_settings.id), None)
            if repository:
                await repository_service.update_badge_settings(
                    session,
                    organization,
                    repository,
                    repository_settings
                )
            

        await organization.save(session)
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

    async def get_repositories_synced_count(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> dict[UUID, int]:
        repo_count: dict[UUID, int] = dict()

        stmt = (
            sql.select(
                Repository.id,
                sql.func.count(distinct(Issue.id)).label("issue_count"),
                sql.func.count(distinct(PullRequest.id)).label("pull_request_count"),
            )
            .join(
                Issue,
                Issue.repository_id == Repository.id,
                isouter=True,
            )
            .join(
                PullRequest,
                PullRequest.repository_id == Repository.id,
                isouter=True,
            )
            .where(
                Repository.organization_id == organization.id,
                or_(
                    or_(PullRequest.state == "open", PullRequest.state == None),  # noqa
                    or_(Issue.state == "open", Issue.state == None),  # noqa
                ),
            )
            .group_by(Repository.id)
        )

        res = await session.execute(stmt)
        rows = res.unique().all()

        for r in rows:
            repo_count[r[0]] = int(r[1]) + int(r[2])

        return repo_count


organization = OrganizationService(Organization)

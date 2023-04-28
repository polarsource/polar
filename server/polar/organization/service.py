from typing import Sequence
from uuid import UUID
from datetime import datetime, timezone

import structlog
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    InstrumentedAttribute,
    contains_eager,
)

from polar.kit.services import ResourceService
from polar.exceptions import ResourceNotFound
from polar.models import Organization, User, UserOrganization, Repository, Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql
from polar.issue.service import issue as issue_service
from polar.worker import enqueue_job

from .schemas import (
    OrganizationCreate,
    OrganizationSettingsUpdate,
    OrganizationUpdate,
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

    async def update_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        settings: OrganizationSettingsUpdate,
    ) -> Organization:
        # Leverage .update() in case we expand this with additional settings
        enabled_pledge_badge_retroactive = False
        disabled_pledge_badge_retroactive = False

        if settings.pledge_badge_retroactive is not None:
            if (
                not organization.pledge_badge_retroactive
                and settings.pledge_badge_retroactive
            ):
                enabled_pledge_badge_retroactive = True
            elif (
                organization.pledge_badge_retroactive
                and not settings.pledge_badge_retroactive
            ):
                disabled_pledge_badge_retroactive = True

            organization.pledge_badge_retroactive = settings.pledge_badge_retroactive

        if settings.pledge_badge_show_amount is not None:
            organization.pledge_badge_show_amount = settings.pledge_badge_show_amount

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(timezone.utc)

        # if settings.email_notification_issue_receives_backing is not None:
        #     organization.email_notification_issue_receives_backing = (
        #         settings.email_notification_issue_receives_backing
        #     )
        #
        # if settings.email_notification_backed_issue_branch_created is not None:
        #     organization.email_notification_backed_issue_branch_created = (
        #         settings.email_notification_backed_issue_branch_created
        #     )
        #
        # if settings.email_notification_backed_issue_pull_request_created is not None:
        #     organization.email_notification_backed_issue_pull_request_created = (
        #         settings.email_notification_backed_issue_pull_request_created
        #     )
        #
        # if settings.email_notification_backed_issue_pull_request_merged is not None:
        #     organization.email_notification_backed_issue_pull_request_merged = (
        #         settings.email_notification_backed_issue_pull_request_merged
        #     )

        updated = await organization.save(session)
        log.info(
            "organization.update_settings",
            organization_id=organization.id,
            settings=settings.dict(),
        )

        if enabled_pledge_badge_retroactive:
            await enqueue_job(
                "github.badge.embed_retroactively_on_organization", organization.id
            )
        elif disabled_pledge_badge_retroactive:
            await enqueue_job("github.badge.remove_on_organization", organization.id)

        return updated


organization = OrganizationService(Organization)

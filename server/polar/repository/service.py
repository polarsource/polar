from typing import Sequence
from uuid import UUID
import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models import Repository
from polar.models.organization import Organization
from polar.organization.schemas import RepositoryBadgeSettingsUpdate
from polar.postgres import AsyncSession, sql
from polar.worker import enqueue_job

from .schemas import RepositoryCreate, RepositoryUpdate


log = structlog.get_logger()


class RepositoryService(
    ResourceService[Repository, RepositoryCreate, RepositoryUpdate]
):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def list_by_organization(
        self,
        session: AsyncSession,
        organization_id: UUID,
        order_by_open_source: bool = False,
    ) -> Sequence[Repository]:
        statement = sql.select(Repository).where(
            Repository.organization_id == organization_id,
            Repository.deleted_at.is_(None),
        )
        if order_by_open_source:
            statement = statement.order_by(
                Repository.is_private, Repository.created_at.desc()
            )

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def list_by_ids_and_organization(
        self,
        session: AsyncSession,
        repository_ids: Sequence[UUID],
        organization_id: UUID,
    ) -> Sequence[Repository]:
        statement = sql.select(Repository).where(
            Repository.organization_id == organization_id,
            Repository.deleted_at.is_(None),
            Repository.id.in_(repository_ids),
        )

        res = await session.execute(statement)
        return res.scalars().unique().all()


    async def update_badge_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        settings: RepositoryBadgeSettingsUpdate,
    ) -> RepositoryBadgeSettingsUpdate:
        enabled_pledge_badge = False
        disabled_pledge_badge = False

        if settings.badge_enabled is not None:
            if settings.badge_enabled and not repository.pledge_badge:
                enabled_pledge_badge = True
            elif not settings.badge_enabled and repository.pledge_badge:
                disabled_pledge_badge = True
            repository.pledge_badge = settings.badge_enabled

        await repository.save(session)
        log.info(
            "repository.update_badge_settings",
            repository_id=repository.id,
            settings=settings.dict(),
        )

        if enabled_pledge_badge and settings.retroactive:
            await enqueue_job(
                "github.badge.embed_retroactively_on_repository",
                organization.id, repository.id
            )
        elif disabled_pledge_badge and settings.retroactive:
            await enqueue_job(
                "github.badge.remove_on_repository",
                organization.id, repository.id
            )

        return settings

repository = RepositoryService(Repository)

from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy.orm import contains_eager

from polar.benefit.benefits.downloadables.files import BenefitDownloadablesFiles
from polar.file.service import file as file_service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import Benefit, User
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.file import File
from polar.postgres import AsyncSession, sql

from .schemas import (
    DownloadableCreate,
    DownloadableRead,
    DownloadableUpdate,
)

log = structlog.get_logger()


class DownloadableService(
    ResourceService[Downloadable, DownloadableCreate, DownloadableUpdate]
):
    async def create_or_update(
        self,
        session: AsyncSession,
        create_schema: DownloadableCreate,
    ) -> Downloadable:
        records = await self.upsert_many(
            session,
            create_schemas=[create_schema],
            constraints=[
                Downloadable.file_id,
                Downloadable.user_id,
                Downloadable.benefit_id,
            ],
            mutable_keys={
                "status",
            },
            autocommit=False,
        )
        await session.flush()
        instance = records[0]
        assert instance.id is not None
        return instance

    async def increment_download_count(
        self,
        session: AsyncSession,
        downloadable: Downloadable,
    ) -> Downloadable:
        downloadable.downloaded += 1
        downloadable.last_downloaded_at = utc_now()
        session.add(downloadable)
        await session.flush()
        return downloadable

    async def get_for_user(
        self,
        session: AsyncSession,
        *,
        user: User,
        pagination: PaginationParams,
        organization_id: UUID | None = None,
    ) -> tuple[Sequence[Downloadable], int]:
        statement = self._get_base_query(user)

        if organization_id:
            statement = statement.where(File.organization_id == organization_id)

        return await paginate(session, statement, pagination=pagination)

    async def get_for_user_by_id(
        self, session: AsyncSession, user: User, id: UUID
    ) -> Downloadable | None:
        statement = self._get_base_query(user)
        statement = statement.where(Downloadable.id == id)
        res = await session.execute(statement)
        record = res.scalars().one_or_none()
        return record

    async def get_for_user_by_file_ids(
        self,
        session: AsyncSession,
        *,
        user: User,
        pagination: PaginationParams,
        ids: list[UUID],
    ) -> tuple[Sequence[Downloadable], int]:
        statement = self._get_base_query(user)
        statement = statement.where(File.id.in_(ids))
        return await paginate(session, statement, pagination=pagination)

    async def get_for_user_by_benefit_id(
        self,
        session: AsyncSession,
        user: User,
        pagination: PaginationParams,
        benefit_id: UUID,
    ) -> tuple[Sequence[Downloadable], int]:
        # Our base query ensures user can only access files they have a
        # relationship with, i.e no upfront validation required.
        benefit_files = BenefitDownloadablesFiles(session, benefit_id)
        file_ids = await benefit_files.get_file_ids()
        if not file_ids:
            return ([], 0)

        downloadables, count = await self.get_for_user_by_file_ids(
            session, user=user, pagination=pagination, ids=file_ids
        )
        mapping = {downloadable.file_id: downloadable for downloadable in downloadables}
        sorted = await benefit_files.sort_mapping(mapping)
        return sorted, count

    def generate_downloadable_schemas(
        self, downloadables: Sequence[Downloadable]
    ) -> list[DownloadableRead]:
        items = []
        for downloadable in downloadables:
            item = self.generate_downloadable_schema(downloadable)
            items.append(item)
        return items

    def generate_downloadable_schema(
        self, downloadable: Downloadable
    ) -> DownloadableRead:
        file_schema = file_service.generate_downloadable_schema(downloadable.file)
        return DownloadableRead(
            id=downloadable.id,
            benefit_id=downloadable.benefit_id,
            file=file_schema,
        )

    def _get_base_query(self, user: User) -> sql.Select:
        statement = (
            sql.select(Downloadable)
            .join(File)
            .join(Benefit)
            .options(contains_eager(Downloadable.file))
            .where(
                Downloadable.user_id == user.id,
                Downloadable.status == DownloadableStatus.granted,
                Downloadable.deleted_at.is_(None),
                File.deleted_at.is_(None),
                File.is_uploaded == True,  # noqa
                File.is_enabled == True,  # noqa
                Benefit.deleted_at.is_(None),
            )
            .order_by(Downloadable.created_at.desc())
        )
        return statement


downloadable = DownloadableService(Downloadable)

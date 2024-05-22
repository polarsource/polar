from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy.orm import contains_eager

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


class BenefitDownloadablesPagination:
    def __init__(self, benefit: Benefit, pagination: PaginationParams) -> None:
        self.benefit = benefit
        self.pagination = pagination

        self.files = self.get_active_files()
        self.count = len(self.files)

    def get_page_ids(self) -> list[str]:
        page = self.pagination.page
        limit = self.pagination.limit

        floor = (page - 1) * limit
        ceiling = page * limit
        return self.files[floor:ceiling]

    def get_active_files(self) -> list[str]:
        files = self.benefit.properties.get("files", [])
        if not files:
            return []

        # TODO: Allow disabling files in benefit and filter them here
        return files


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

    def get_query_for_user_accessibles(self, user: User) -> sql.Select:
        statement = (
            sql.select(Downloadable)
            .join(File)
            .options(contains_eager(Downloadable.file))
            .options(contains_eager(Downloadable.benefit))
            .where(
                Downloadable.user_id == user.id,
                Downloadable.status == DownloadableStatus.granted,
                Downloadable.deleted_at.is_(None),
                File.deleted_at.is_(None),
                File.last_modified_at.is_not(None),
                Benefit.deleted_at.is_(None),
            )
            .order_by(Downloadable.created_at.desc())
        )
        return statement

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

    async def get_accessible_for_user(
        self,
        session: AsyncSession,
        *,
        user: User,
        pagination: PaginationParams,
        organization_id: UUID | None = None,
    ) -> tuple[Sequence[Downloadable], int]:
        statement = self.get_query_for_user_accessibles(user)

        if organization_id:
            statement = statement.where(File.organization_id == organization_id)

        return await paginate(session, statement, pagination=pagination)

    async def get_accessible_for_user_by_id(
        self, session: AsyncSession, user: User, id: UUID
    ) -> Downloadable | None:
        statement = self.get_query_for_user_accessibles(user)
        statement = statement.where(Downloadable.id == id)
        res = await session.execute(statement)
        record = res.scalars().one_or_none()
        return record

    async def get_accessible_for_user_by_file_ids(
        self, session: AsyncSession, user: User, ids: list[str]
    ) -> Sequence[Downloadable]:
        statement = self.get_query_for_user_accessibles(user)
        statement = statement.where(File.id.in_(ids))
        res = await session.execute(statement)
        record = res.scalars().all()
        return record

    async def get_accessible_for_user_by_benefit_id(
        self,
        session: AsyncSession,
        user: User,
        pagination: PaginationParams,
        benefit_id: UUID,
        organization_id: UUID | None = None,
    ) -> tuple[Sequence[Downloadable], int]:
        query = sql.select(Benefit).where(
            Benefit.id == benefit_id, Benefit.deleted_at.is_(None)
        )
        if organization_id:
            query = query.where(Benefit.organization_id == organization_id)

        res = await session.execute(query)
        benefit = res.scalars().unique().one_or_none()
        if not benefit:
            return ([], 0)

        benefit_pagination = BenefitDownloadablesPagination(benefit, pagination)
        file_ids = benefit_pagination.get_page_ids()

        downloadables = await self.get_accessible_for_user_by_file_ids(
            session, user, ids=file_ids
        )
        mapping = {
            str(downloadable.file_id): downloadable for downloadable in downloadables
        }

        count = benefit_pagination.count
        items = []
        for file_id in file_ids:
            downloadable = mapping.get(file_id, None)
            if not downloadable:
                count -= 1
                continue

            items.append(downloadable)

        return (items, benefit_pagination.count)

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


downloadable = DownloadableService(Downloadable)

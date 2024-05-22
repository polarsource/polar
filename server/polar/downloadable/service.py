from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy.orm import contains_eager

from polar.file.service import file as file_service
from polar.file.service import s3_service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import User
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

    async def get(
        self, session: AsyncSession, id: UUID, allow_deleted: bool = False
    ) -> Downloadable | None:
        statement = (
            sql.select(Downloadable)
            .join(File)
            .options(contains_eager(Downloadable.file))
            .where(
                Downloadable.id == id,
                File.deleted_at.is_(None),
                File.last_modified_at.is_not(None),
            )
        )
        if not allow_deleted:
            statement = statement.where(Downloadable.deleted_at.is_(None))

        res = await session.execute(statement)
        record = res.scalars().one_or_none()
        return record

    async def generate_presigned_download(self, file: File) -> tuple[str, datetime]:
        return s3_service.generate_presigned_download_url(
            path=file.path,
            filename=file.name,
            mime_type=file.mime_type,
        )

    async def increment_download_count(
        self,
        session: AsyncSession,
        downloadable: Downloadable,
    ) -> Downloadable:
        downloadable.downloaded += 1
        downloadable.latest_download_at = utc_now()
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
        benefit_id: UUID | None = None,
    ) -> tuple[Sequence[Downloadable], int]:
        statement = (
            sql.select(Downloadable)
            .join(File)
            .options(contains_eager(Downloadable.file))
            .where(
                Downloadable.user_id == user.id,
                Downloadable.status == DownloadableStatus.granted,
                Downloadable.deleted_at.is_(None),
                File.deleted_at.is_(None),
            )
        )

        if organization_id:
            statement = statement.where(File.organization_id == organization_id)

        if benefit_id:
            statement = statement.where(Downloadable.benefit_id == benefit_id)

        return await paginate(session, statement, pagination=pagination)

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

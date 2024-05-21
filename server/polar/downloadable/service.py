from collections.abc import Sequence
from datetime import datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.integrations.aws.s3 import S3Service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import User
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.file import File
from polar.postgres import AsyncSession, sql

from .schemas import (
    DownloadableCreate,
    DownloadableUpdate,
)

log = structlog.get_logger()


class FileError(PolarError): ...


class UnsupportedFile(FileError): ...


class FileNotFound(ResourceNotFound): ...


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
            .options(joinedload(Downloadable.file))
            .where(
                Downloadable.id == id,
                File.deleted_at.is_(None),
                File.uploaded_at.is_not(None),
            )
        )
        if not allow_deleted:
            statement = statement.where(Downloadable.deleted_at.is_(None))

        res = await session.execute(statement)
        record = res.scalars().one_or_none()
        return record

    async def generate_presigned_download(self, file: File) -> tuple[str, datetime]:
        expires_in = settings.S3_FILES_PRESIGN_TTL
        presigned_at = utc_now()
        signed_download_url = S3Service.client.generate_presigned_url(
            "get_object",
            Params=dict(
                Bucket=settings.S3_FILES_BUCKET_NAME,
                Key=file.path,
                ResponseContentDisposition=S3Service.downloadable_disposition(
                    file.name
                ),
                ResponseContentType=file.mime_type,
            ),
            ExpiresIn=expires_in,
        )

        presign_expires_at = presigned_at + timedelta(seconds=expires_in)
        return (signed_download_url, presign_expires_at)

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

    async def get_user_accessible_files(
        self,
        session: AsyncSession,
        *,
        user: User,
        pagination: PaginationParams,
        organization_id: UUID | None = None,
        benefit_id: UUID | None = None,
    ) -> tuple[Sequence[File], int]:
        statement = (
            sql.select(File)
            .join(Downloadable)
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


downloadable = DownloadableService(Downloadable)

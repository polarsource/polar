from collections.abc import Sequence
from uuid import UUID

import structlog

from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.integrations.aws.s3 import S3FileError, S3Service, S3UnsupportedFile
from polar.kit.services import ResourceService
from polar.models import Organization
from polar.models.file import File
from polar.postgres import AsyncSession, sql

from .schemas import (
    FileCreate,
    FileDownload,
    FileRead,
    FileUpdate,
    FileUpload,
    FileUploadCompleted,
)

log = structlog.get_logger()


class FileError(S3FileError): ...


class UnsupportedFile(S3UnsupportedFile): ...


class FileNotFound(ResourceNotFound): ...


s3_service = S3Service(
    bucket=settings.S3_FILES_BUCKET_NAME,
    presign_ttl=settings.S3_FILES_PRESIGN_TTL,
)


class FileService(ResourceService[File, FileCreate, FileUpdate]):
    async def get_by_ids(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        ids: list[UUID] | list[str],
    ) -> Sequence[File]:
        statement = sql.select(File).where(
            File.organization_id == organization_id,
            File.is_uploaded == True,  # noqa
            File.deleted_at.is_(None),
            File.id.in_(ids),
        )
        res = await session.execute(statement)
        records = res.scalars().all()
        return records

    async def generate_presigned_upload(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        create_schema: FileCreate,
    ) -> FileUpload:
        upload = s3_service.create_multipart_upload(
            create_schema, namespace=create_schema.service.value
        )

        instance = File(
            organization=organization,
            service=create_schema.service,
            is_enabled=True,
            is_uploaded=False,
            **upload.model_dump(exclude={"upload", "organization_id"}),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        return FileUpload(
            is_enabled=instance.is_enabled,
            is_uploaded=instance.is_uploaded,
            service=create_schema.service,
            **upload.model_dump(),
        )

    async def complete_upload(
        self,
        session: AsyncSession,
        *,
        file: File,
        completed_schema: FileUploadCompleted,
    ) -> FileRead:
        s3file = s3_service.complete_multipart_upload(completed_schema)

        file.is_uploaded = True

        if s3file.checksum_etag:
            file.checksum_etag = s3file.checksum_etag

        if s3file.last_modified_at:
            file.last_modified_at = s3file.last_modified_at

        if s3file.storage_version:
            file.storage_version = s3file.storage_version

        session.add(file)
        await session.flush()
        assert file.checksum_etag is not None
        assert file.last_modified_at is not None

        return FileRead.from_db(file)

    def generate_downloadable_schemas(
        self, files: Sequence[File]
    ) -> list[FileDownload]:
        items = []
        for file in files:
            item = self.generate_downloadable_schema(file)
            items.append(item)
        return items

    def generate_downloadable_schema(self, file: File) -> FileDownload:
        url, expires_at = s3_service.generate_presigned_download_url(
            path=file.path,
            filename=file.name,
            mime_type=file.mime_type,
        )
        return FileDownload.from_db_presigned(file, url=url, expires_at=expires_at)


file = FileService(File)

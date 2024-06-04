from collections.abc import Sequence
from uuid import UUID

import structlog

from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.integrations.aws.s3 import S3FileError, S3Service, S3UnsupportedFile
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.models.file import File
from polar.postgres import AsyncSession, sql

from .schemas import (
    FileCreate,
    FileDownload,
    FilePatch,
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
    async def get_list(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        pagination: PaginationParams,
        ids: list[UUID] | None = None,
    ) -> tuple[Sequence[File], int]:
        statement = (
            sql.select(File)
            .where(
                File.organization_id == organization_id,
                File.is_uploaded == True,  # noqa
                File.deleted_at.is_(None),
            )
            .order_by(File.created_at.desc())
        )
        if ids:
            statement = statement.where(File.id.in_(ids))

        return await paginate(session, statement, pagination=pagination)

    async def patch(
        self,
        session: AsyncSession,
        *,
        file: File,
        patches: FilePatch,
    ) -> File:
        changes = False
        if patches.name:
            file.name = patches.name
            changes = True

        if patches.version:
            file.version = patches.version
            changes = True

        if not changes:
            return file

        session.add(file)
        await session.flush()
        return file

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
            **upload.model_dump(exclude={"upload", "organization_id", "size_readable"}),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        return FileUpload(
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
        return FileDownload.from_presigned(file, url=url, expires_at=expires_at)

    async def delete(
        self,
        session: AsyncSession,
        *,
        file: File,
    ) -> bool:
        file.deleted_at = utc_now()
        session.add(file)
        await session.flush()
        assert file.deleted_at is not None

        deleted = s3_service.delete_file(file.path)
        log.info("file.delete", file_id=file.id, s3_deleted=deleted)
        return True


file = FileService(File)

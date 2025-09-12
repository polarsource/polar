import uuid
from collections.abc import Sequence

import structlog

from polar.auth.models import AuthSubject
from polar.integrations.aws.s3 import S3FileError
from polar.kit.pagination import PaginationParams
from polar.models import Organization, ProductMedia, User
from polar.models.file import File, ProductMediaFile
from polar.postgres import AsyncReadSession, AsyncSession, sql

from .repository import FileRepository
from .s3 import S3_SERVICES
from .schemas import (
    FileCreate,
    FileDownload,
    FilePatch,
    FileUpload,
    FileUploadCompleted,
)

log = structlog.get_logger()


class FileError(S3FileError): ...


class FileService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        ids: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[File], int]:
        repository = FileRepository.from_session(session)

        statement = repository.get_readable_statement(auth_subject).where(
            File.is_uploaded.is_(True)
        )

        if organization_id is not None:
            statement = statement.where(File.organization_id.in_(organization_id))

        if ids is not None:
            statement = statement.where(File.id.in_(ids))

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> File | None:
        repository = FileRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(File.id == id)
        return await repository.get_one_or_none(statement)

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
        s3_service = S3_SERVICES[create_schema.service]
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
            version=instance.version,
            service=create_schema.service,
            **upload.model_dump(),
        )

    async def complete_upload(
        self,
        session: AsyncSession,
        *,
        file: File,
        completed_schema: FileUploadCompleted,
    ) -> File:
        s3_service = S3_SERVICES[file.service]
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

        return file

    def generate_downloadable_schema(self, file: File) -> FileDownload:
        s3_service = S3_SERVICES[file.service]
        url, expires_at = s3_service.generate_presigned_download_url(
            path=file.path,
            filename=file.name,
            mime_type=file.mime_type,
        )
        return FileDownload.from_presigned(file, url=url, expires_at=expires_at)

    async def delete(self, session: AsyncSession, *, file: File) -> bool:
        file.set_deleted_at()
        session.add(file)
        assert file.deleted_at is not None

        # Delete ProductMedia association table records
        statement = sql.delete(ProductMedia).where(ProductMedia.file_id == file.id)
        await session.execute(statement)

        s3_service = S3_SERVICES[file.service]
        deleted = s3_service.delete_file(file.path)
        log.info("file.delete", file_id=file.id, s3_deleted=deleted)
        return True

    async def get_selectable_product_media_file(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        *,
        organization_id: uuid.UUID,
    ) -> ProductMediaFile | None:
        statement = sql.select(ProductMediaFile).where(
            File.id == id,
            File.organization_id == organization_id,
            File.is_uploaded.is_(True),
            File.is_enabled.is_(True),
            File.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()


file = FileService()

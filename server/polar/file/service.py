import mimetypes
from datetime import timedelta

import structlog

from polar.config import settings
from polar.exceptions import BadRequest, PolarError, ResourceNotFound
from polar.kit.services import ResourceService
from polar.kit.utils import generate_uuid, utc_now
from polar.models import Organization, User
from polar.models.file import File, FileStatus
from polar.models.file_permission import FilePermission, FilePermissionStatus
from polar.postgres import AsyncSession, sql

from .client import s3_client
from .schemas import (
    FileCreate,
    FilePermissionCreate,
    FilePermissionUpdate,
    FilePresignedRead,
    FileUpdate,
    get_disposition,
)

log = structlog.get_logger()


class FileError(PolarError):
    ...


class UnsupportedFile(FileError):
    ...


class FileNotFound(ResourceNotFound):
    ...


class FileService(ResourceService[File, FileCreate, FileUpdate]):
    async def generate_presigned_upload_url(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        create_schema: FileCreate,
    ) -> FilePresignedRead:
        file_uuid = generate_uuid()
        # TODO: Move this to schema validation
        extension = mimetypes.guess_extension(create_schema.mime_type)
        if not extension:
            raise UnsupportedFile("Cannot determine file extension")

        file_name = f"{file_uuid}{extension}"
        # Each organization gets its own directory
        key = f"{organization.id}/{file_name}"

        hex = None
        base64 = None
        metadata = {}
        checksums = create_schema.sha256
        if checksums:
            base64 = checksums.base64
            hex = checksums.hex
            metadata = {
                "sha256-hex": hex,
                "sha256-base64": base64,
            }

        expires_in = settings.S3_FILES_PRESIGN_TTL
        presigned_at = utc_now()
        signed_post_url = s3_client.generate_presigned_url(
            "put_object",
            Params=dict(
                Bucket=settings.S3_FILES_BUCKET_NAME,
                Key=key,
                ContentDisposition=get_disposition(create_schema.name),
                ContentType=create_schema.mime_type,
                ChecksumAlgorithm="SHA256",
                ChecksumSHA256=base64,
                Metadata=metadata,
            ),
            ExpiresIn=expires_in,
        )
        presign_expires_at = presigned_at + timedelta(seconds=expires_in)

        instance = File(
            key=key,
            extension=extension[1:],
            status=FileStatus.awaiting_upload,
            presigned_at=utc_now(),
            presign_expiration=expires_in,
            presign_expires_at=presign_expires_at,
            sha256_base64=base64,
            sha256_hex=hex,
            **create_schema.model_dump(exclude={"sha256"}),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        return FilePresignedRead.from_presign(
            instance,
            url=signed_post_url,
            expires_at=presign_expires_at,
        )

    async def generate_presigned_download_url(
        self, session: AsyncSession, *, user: User, file: File
    ) -> FilePresignedRead:
        expires_in = settings.S3_FILES_PRESIGN_TTL
        presigned_at = utc_now()
        signed_download_url = s3_client.generate_presigned_url(
            "get_object",
            Params=dict(
                Bucket=settings.S3_FILES_BUCKET_NAME,
                Key=file.key,
                ResponseContentDisposition=get_disposition(file.name),
                ResponseContentType=file.mime_type,
            ),
            ExpiresIn=expires_in,
        )

        presign_expires_at = presigned_at + timedelta(seconds=expires_in)
        return FilePresignedRead.from_presign(
            file,
            url=signed_download_url,
            expires_at=presign_expires_at,
        )

    async def mark_uploaded(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        file: File,
    ) -> File:
        metadata = s3_client.get_object_attributes(
            Bucket=settings.S3_FILES_BUCKET_NAME,
            Key=file.key,
            # VersionId=file.version,
            ObjectAttributes=[
                "ETag",
                "Checksum",
                "ObjectSize",
            ],
        )
        if not metadata:
            log.error("aws.s3", file_id=file.id, key=file.key, error="No S3 metadata")
            raise FileNotFound(f"No S3 metadata exists for ID: {file.id}")

        checksums = metadata.get("Checksum", {})
        sha256_base64 = checksums.get("ChecksumSHA256")
        if file.sha256_base64 and sha256_base64 != file.sha256_base64:
            log.error("aws.s3", file_id=file.id, key=file.key, error="SHA256 missmatch")
            raise BadRequest()

        file.sha256_base64 = sha256_base64
        file.status = FileStatus.uploaded
        file.uploaded_at = metadata["LastModified"]
        file.etag = metadata.get("ETag")
        file.version_id = metadata.get("VersionId")
        # Update size from S3 or fallback on original size given by client
        file.size = metadata.get("ObjectSize", file.size)

        session.add(file)
        await session.flush()
        assert file.uploaded_at is not None

        return file


class FilePermissionService(
    ResourceService[FilePermission, FilePermissionCreate, FilePermissionUpdate]
):
    async def create_or_update(
        self,
        session: AsyncSession,
        create_schema: FilePermissionCreate,
    ) -> FilePermission:
        records = await self.upsert_many(
            session,
            create_schemas=[create_schema],
            constraints=[FilePermission.file_id, FilePermission.user_id],
            mutable_keys={
                "status",
            },
            autocommit=False,
        )
        await session.flush()
        instance = records[0]
        assert instance.id is not None
        return instance

    async def get_permission(
        self, session: AsyncSession, *, user: User, file: File
    ) -> FilePermission | None:
        statement = sql.select(FilePermission).where(
            FilePermission.user_id == user.id,
            FilePermission.file_id == file.id,
            FilePermission.status == FilePermissionStatus.granted,
        )
        res = await session.execute(statement)
        record = res.scalars().one_or_none()
        return record

    async def increment_download_count(
        self,
        session: AsyncSession,
        permission: FilePermission,
    ) -> FilePermission:
        permission.downloaded += 1
        permission.latest_download_at = utc_now()
        session.add(permission)
        await session.flush()
        return permission


file = FileService(File)
file_permission = FilePermissionService(FilePermission)

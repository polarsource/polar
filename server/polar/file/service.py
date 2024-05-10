import mimetypes
from datetime import timedelta

import structlog

from polar.config import settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.services import ResourceService
from polar.kit.utils import generate_uuid, utc_now
from polar.models import Organization
from polar.models.file import File, FileStatus
from polar.postgres import AsyncSession

from .client import s3_client
from .schemas import FileCreate, FilePresignedRead, FileUpdate

log = structlog.get_logger()


class FileError(PolarError):
    ...


class UnsupportedFile(FileError):
    ...


class FileNotFound(ResourceNotFound):
    ...


class FileService(ResourceService[File, FileCreate, FileUpdate]):
    async def generate_presigned_url(
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

        expires_in = 3600
        presigned_at = utc_now()
        signed_post_url = s3_client.generate_presigned_url(
            "put_object",
            Params=dict(
                Bucket=settings.AWS_S3_FILES_BUCKET_NAME,
                Key=key,
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
            **create_schema.model_dump(),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        return FilePresignedRead.from_presign(instance, url=signed_post_url)

    async def mark_uploaded(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        file: File,
    ) -> File:
        metadata = s3_client.get_object_attributes(
            Bucket=settings.AWS_S3_FILES_BUCKET_NAME,
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

        checksums = metadata.get("Checksums", {})
        file.status = FileStatus.uploaded
        file.uploaded_at = metadata["LastModified"]
        file.etag = metadata.get("ETag")
        file.version_id = metadata.get("VersionId")
        file.checksum_sha256 = checksums.get("ChecksumSHA256")
        # Update size from S3 or fallback on original size given by client
        file.size = metadata.get("ObjectSize", file.size)

        session.add(file)
        await session.flush()
        assert file.uploaded_at is not None

        return file


file = FileService(File)

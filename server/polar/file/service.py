import base64
import mimetypes
from datetime import timedelta

import structlog

from polar.config import settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.integrations.aws.s3 import S3Service
from polar.kit.services import ResourceService
from polar.kit.utils import generate_uuid, utc_now
from polar.models import Organization
from polar.models.file import File
from polar.postgres import AsyncSession

from .schemas import (
    FileCreate,
    FileCreatePart,
    FileUpdate,
    FileUpload,
    FileUploadCompleted,
    FileUploadPart,
)

log = structlog.get_logger()


class FileError(PolarError): ...


class UnsupportedFile(FileError): ...


class FileNotFound(ResourceNotFound): ...


class FileService(ResourceService[File, FileCreate, FileUpdate]):
    async def generate_presigned_upload(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        create_schema: FileCreate,
    ) -> FileUpload:
        file_uuid = generate_uuid()
        # TODO: Move this to schema validation
        extension = mimetypes.guess_extension(create_schema.mime_type)
        if not extension:
            raise UnsupportedFile("Cannot determine file extension")

        filename = f"{file_uuid}{extension}"
        # Each organization gets its own directory
        path = f"{organization.id}/{filename}"

        metadata = {}
        sha256_hex = None
        sha256_base64 = None
        if create_schema.checksum_sha256_base64:
            sha256_base64 = create_schema.checksum_sha256_base64
            sha256_hex = base64.b64decode(sha256_base64).hex()
            metadata = {
                "file-sha256-hex": sha256_hex,
                "file-sha256-base64": sha256_base64,
            }

        multipart_upload = S3Service.client.create_multipart_upload(
            Bucket=settings.S3_FILES_BUCKET_NAME,
            Key=path,
            ContentDisposition=S3Service.downloadable_disposition(create_schema.name),
            ContentType=create_schema.mime_type,
            ChecksumAlgorithm="SHA256",
            Metadata=metadata,
        )
        multipart_upload_id = multipart_upload.get("UploadId")
        if not multipart_upload_id:
            log.error(
                "aws.s3",
                organization_id=organization.id,
                filename=filename,
                mime_type=create_schema.mime_type,
                size=create_schema.size,
                error="No upload ID returned from S3",
            )
            raise FileError("No upload ID returned from S3")

        instance = File(
            organization=organization,
            upload_id=multipart_upload_id,
            path=path,
            extension=extension[1:],
            presigned_at=utc_now(),
            sha256_base64=sha256_base64,
            sha256_hex=sha256_hex,
            **create_schema.model_dump(
                exclude={"checksum_sha256_base64", "upload", "organization_id"}
            ),
        )
        session.add(instance)
        await session.flush()
        assert instance.id is not None

        parts = await self.generate_presigned_upload_parts(
            file=instance,
            parts=create_schema.upload.parts,
            upload_id=multipart_upload_id,
        )

        return FileUpload.from_presign(
            instance,
            upload_id=multipart_upload_id,
            parts=parts,
        )

    async def generate_presigned_upload_parts(
        self,
        *,
        file: File,
        parts: list[FileCreatePart],
        upload_id: str,
    ) -> list[FileUploadPart]:
        ret = []
        expires_in = settings.S3_FILES_PRESIGN_TTL
        presigned_at = utc_now()
        for part in parts:
            signed_post_url = S3Service.client.generate_presigned_url(
                "upload_part",
                Params=dict(
                    UploadId=upload_id,
                    Bucket=settings.S3_FILES_BUCKET_NAME,
                    Key=file.path,
                    **part.get_s3_arguments(),
                ),
                ExpiresIn=expires_in,
            )
            presign_expires_at = presigned_at + timedelta(seconds=expires_in)
            headers = FileUploadPart.generate_headers(part.checksum_sha256_base64)
            ret.append(
                FileUploadPart(
                    number=part.number,
                    chunk_start=part.chunk_start,
                    chunk_end=part.chunk_end,
                    checksum_sha256_base64=part.checksum_sha256_base64,
                    url=signed_post_url,
                    expires_at=presign_expires_at,
                    headers=headers,
                )
            )
        return ret

    async def complete_upload(
        self,
        session: AsyncSession,
        *,
        file: File,
        payload: FileUploadCompleted,
    ) -> File:
        response = S3Service.client.complete_multipart_upload(
            Bucket=settings.S3_FILES_BUCKET_NAME,
            Key=file.path,
            **payload.get_s3_arguments(),
        )

        file.etag = response.get("ETag")
        file.s3_version_id = response.get("VersionId")
        file.uploaded_at = utc_now()

        session.add(file)
        await session.flush()
        assert file.uploaded_at is not None

        return file


file = FileService(File)

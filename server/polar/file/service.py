import mimetypes
from datetime import timedelta

from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.services import ResourceService
from polar.kit.utils import generate_uuid, utc_now
from polar.models import Organization
from polar.models.file import File, FileStatus
from polar.postgres import AsyncSession

from .client import s3_client
from .schemas import FileCreate, FileRead, FileUpdate


class FileError(PolarError):
    ...


class UnsupportedFile(FileError):
    ...


class FileService(ResourceService[File, FileCreate, FileUpdate]):
    @classmethod
    async def generate_presigned_url(
        cls,
        session: AsyncSession,
        *,
        organization: Organization,
        create_schema: FileCreate,
    ) -> FileRead:
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

        return FileRead.from_presign(instance, url=signed_post_url)

from polar.config import settings

from .client import s3_client
from .schemas import FileCreate, FileCreateSignedURL


class FileService:
    @classmethod
    def generate_presigned_url(cls, file: FileCreate) -> FileCreateSignedURL:
        signed_post_url = s3_client.generate_presigned_url(
            "put_object",
            Params=dict(
                Bucket=settings.AWS_S3_FILES_BUCKET_NAME,
                Key=file.name,
            ),
            ExpiresIn=3600,
        )
        return FileCreateSignedURL(
            url=signed_post_url,
        )

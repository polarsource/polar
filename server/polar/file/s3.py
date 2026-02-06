from polar.config import settings
from polar.integrations.aws.s3 import S3Service
from polar.models.file import FileServiceTypes


def _get_s3_service(bucket: str) -> S3Service:
    return S3Service(
        bucket=bucket,
        presign_ttl=settings.S3_FILES_PRESIGN_TTL,
    )


S3_SERVICES: dict[FileServiceTypes, S3Service] = {
    FileServiceTypes.downloadable: _get_s3_service(settings.S3_FILES_BUCKET_NAME),
    FileServiceTypes.product_media: _get_s3_service(
        settings.S3_FILES_PUBLIC_BUCKET_NAME
    ),
    FileServiceTypes.organization_avatar: _get_s3_service(
        settings.S3_FILES_PUBLIC_BUCKET_NAME
    ),
    FileServiceTypes.oauth_logo: _get_s3_service(settings.S3_FILES_PUBLIC_BUCKET_NAME),
}

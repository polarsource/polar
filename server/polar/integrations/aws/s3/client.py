from typing import TYPE_CHECKING

import boto3
from botocore.config import Config

from polar.config import settings
from polar.kit.aws import get_credentials

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client


def get_client(
    *,
    signature_version: str = settings.AWS_SIGNATURE_VERSION,
    endpoint_url: str | None = settings.S3_ENDPOINT_URL,
) -> "S3Client":
    access_key_id, secret_access_key = get_credentials()
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(
            region_name=settings.AWS_REGION,
            signature_version=signature_version,
            connect_timeout=settings.AWS_S3_CONNECT_TIMEOUT_SECONDS,
            read_timeout=settings.AWS_S3_READ_TIMEOUT_SECONDS,
            retries={"mode": "standard", "max_attempts": settings.AWS_S3_MAX_ATTEMPTS},
        ),
    )


client = get_client()

__all__ = ("client", "get_client")

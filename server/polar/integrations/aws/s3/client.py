import boto3
from botocore.config import Config

from polar.config import settings

client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    config=Config(
        region_name=settings.AWS_REGION,
        signature_version=settings.AWS_SIGNATURE_VERSION,
    ),
)

__all__ = ("client",)

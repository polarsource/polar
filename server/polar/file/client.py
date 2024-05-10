import boto3
from botocore.config import Config

from polar.config import settings

config = Config(
    region_name=settings.AWS_REGION,
    signature_version=settings.AWS_SIGNATURE_VERSION,
)

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    config=config,
)

__all__ = ("s3_client",)

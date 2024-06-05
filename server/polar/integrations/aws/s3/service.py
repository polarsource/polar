import base64
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, cast

import structlog
from botocore.client import ClientError

from polar.kit.utils import generate_uuid, utc_now

from .client import client
from .exceptions import S3FileError
from .schemas import (
    S3File,
    S3FileCreate,
    S3FileCreatePart,
    S3FileUpload,
    S3FileUploadCompleted,
    S3FileUploadMultipart,
    S3FileUploadPart,
    get_downloadable_content_disposition,
)

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client

log = structlog.get_logger()


class S3Service:
    def __init__(
        self,
        bucket: str,
        presign_ttl: int = 600,
        client: "S3Client" = client,
    ):
        self.bucket = bucket
        self.presign_ttl = presign_ttl
        self.client = client

    def create_multipart_upload(
        self, data: S3FileCreate, namespace: str = ""
    ) -> S3FileUpload:
        if not data.organization_id:
            raise S3FileError("Organization ID is required")

        file_uuid = generate_uuid()
        # Each organization gets its own directory
        # Containing one directory per file: {file_uuid}/{data.name}
        # Allowing multiple files to be named the same.
        path = f"{namespace}/{data.organization_id}/{file_uuid}/{data.name}"

        file = S3File(
            id=file_uuid,
            organization_id=data.organization_id,
            name=data.name,
            path=path,
            mime_type=data.mime_type,
            size=data.size,
        )

        if data.checksum_sha256_base64:
            sha256_base64 = data.checksum_sha256_base64
            file.checksum_sha256_base64 = sha256_base64
            file.checksum_sha256_hex = base64.b64decode(sha256_base64).hex()

        multipart_upload = self.client.create_multipart_upload(
            Bucket=self.bucket,
            Key=file.path,
            ContentType=file.mime_type,
            ChecksumAlgorithm="SHA256",
            Metadata=file.to_metadata(),
        )
        multipart_upload_id = multipart_upload.get("UploadId")
        if not multipart_upload_id:
            log.error(
                "aws.s3",
                organization_id=file.organization_id,
                filename=file.name,
                mime_type=file.mime_type,
                size=file.size,
                error="No upload ID returned from S3",
            )
            raise S3FileError("No upload ID returned from S3")

        parts = self.generate_presigned_upload_parts(
            path=file.path,
            parts=data.upload.parts,
            upload_id=multipart_upload_id,
        )

        upload = S3FileUpload(
            upload=S3FileUploadMultipart(
                id=multipart_upload_id,
                # Keep a shorthand for path here too for upload
                path=file.path,
                parts=parts,
            ),
            **file.model_dump(),
        )
        return upload

    def generate_presigned_upload_parts(
        self,
        *,
        path: str,
        parts: list[S3FileCreatePart],
        upload_id: str,
    ) -> list[S3FileUploadPart]:
        ret = []
        expires_in = self.presign_ttl
        for part in parts:
            signed_post_url = self.client.generate_presigned_url(
                "upload_part",
                Params=dict(
                    UploadId=upload_id,
                    Bucket=self.bucket,
                    Key=path,
                    **part.get_boto3_arguments(),
                ),
                ExpiresIn=expires_in,
            )
            presign_expires_at = utc_now() + timedelta(seconds=expires_in)
            headers = S3FileUploadPart.generate_headers(part.checksum_sha256_base64)
            ret.append(
                S3FileUploadPart(
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

    def get_object_or_raise(self, path: str, s3_version_id: str = "") -> dict[str, Any]:
        try:
            obj = self.client.get_object(
                Bucket=self.bucket,
                Key=path,
                VersionId=s3_version_id,
                ChecksumMode="ENABLED",
            )
        except ClientError:
            raise S3FileError("No object on S3")

        return cast(dict[str, Any], obj)

    def get_head_or_raise(self, path: str, s3_version_id: str = "") -> dict[str, Any]:
        try:
            head = self.client.head_object(
                Bucket=self.bucket, Key=path, VersionId=s3_version_id
            )
        except ClientError:
            raise S3FileError("No metadata from S3")

        return cast(dict[str, Any], head)

    def complete_multipart_upload(self, data: S3FileUploadCompleted) -> S3File:
        boto_arguments = data.get_boto3_arguments()
        response = self.client.complete_multipart_upload(
            Bucket=self.bucket, Key=data.path, **boto_arguments
        )
        if not response:
            raise S3FileError("No response from S3")

        version_id = response.get("VersionId", "")
        head = self.get_head_or_raise(data.path, s3_version_id=version_id)
        file = S3File.from_head(data.path, head)
        return file

    def generate_presigned_download_url(
        self,
        *,
        path: str,
        filename: str,
        mime_type: str,
    ) -> tuple[str, datetime]:
        expires_in = self.presign_ttl
        presign_from = utc_now()
        signed_download_url = self.client.generate_presigned_url(
            "get_object",
            Params=dict(
                Bucket=self.bucket,
                Key=path,
                ResponseContentDisposition=get_downloadable_content_disposition(
                    filename
                ),
                ResponseContentType=mime_type,
            ),
            ExpiresIn=expires_in,
        )

        presign_expires_at = presign_from + timedelta(seconds=expires_in)
        return (signed_download_url, presign_expires_at)

    def delete_file(self, path: str) -> bool:
        deleted = self.client.delete_object(Bucket=self.bucket, Key=path)
        return deleted.get("DeleteMarker", False)

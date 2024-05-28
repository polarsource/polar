from datetime import datetime
from typing import Any, Self

from pydantic import UUID4

from polar.integrations.aws.s3.schemas import (
    S3DownloadURL,
    S3File,
    S3FileCreate,
    S3FileDownload,
    S3FileUpload,
    S3FileUploadCompleted,
    get_downloadable_content_disposition,
)
from polar.kit.schemas import Schema
from polar.models.file import File, FileServiceTypes


class FileCreate(S3FileCreate):
    service: FileServiceTypes = FileServiceTypes.downloadable


class FileRead(S3File):
    service: FileServiceTypes
    is_uploaded: bool
    created_at: datetime

    @staticmethod
    def prepare_dict_from_db(record: File) -> dict[str, Any]:
        ret = dict(
            id=record.id,
            organization_id=record.organization_id,
            name=record.name,
            extension=record.extension,
            path=record.path,
            mime_type=record.mime_type,
            size=record.size,
            service=record.service,
            checksum_etag=record.checksum_etag,
            last_modified_at=record.last_modified_at,
            storage_version=record.storage_version,
            is_uploaded=record.is_uploaded,
            created_at=record.created_at,
        )
        if record.checksum_sha256_base64 and record.checksum_sha256_hex:
            ret.update(
                checksum_sha256_base64=record.checksum_sha256_base64,
                checksum_sha256_hex=record.checksum_sha256_hex,
            )

        return ret

    @classmethod
    def from_db(cls, record: File) -> Self:
        params = cls.prepare_dict_from_db(record)
        return cls(**params)


class FileUpload(S3FileUpload):
    is_uploaded: bool = False
    service: FileServiceTypes


class FileUploadCompleted(S3FileUploadCompleted): ...


class FileDownload(S3FileDownload):
    is_uploaded: bool
    service: FileServiceTypes

    @classmethod
    def from_db_presigned(cls, file: File, url: str, expires_at: datetime) -> Self:
        download_headers = {
            "Content-Disposition": get_downloadable_content_disposition(file.name),
            "Content-Type": file.mime_type,
            "x-amz-checksum-sha256": file.checksum_sha256_base64,
            "x-amz-sdk-checksum-algorithm": "SHA256",
        }
        if file.checksum_sha256_base64:
            download_headers.update(
                {
                    "x-amz-meta-sha256-base64": file.checksum_sha256_base64,
                    "x-amz-meta-sha256-hex": file.checksum_sha256_hex,
                }
            )

        file_dict = FileRead.prepare_dict_from_db(file)
        return cls(
            **file_dict,
            download=S3DownloadURL(
                url=url,
                expires_at=expires_at,
                headers=download_headers,
            )
        )


class FileUpdate(Schema):
    id: UUID4
    checksum_etag: str
    last_modified_at: datetime
    storage_version: str | None
    checksum_sha256_base64: str | None
    checksum_sha256_hex: str | None


class FilePatch(Schema): ...

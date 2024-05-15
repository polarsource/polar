from datetime import datetime
from typing import Any, Self

from pydantic import UUID4

from polar.kit.schemas import Schema
from polar.models import File
from polar.models.file_permission import FilePermissionStatus


def get_disposition(file_name: str):
    return f'attachment; filename="{file_name}"'


class SHA256Checksums(Schema):
    base64: str | None
    hex: str | None


class FileCreate(Schema):
    organization_id: UUID4
    name: str
    size: int
    mime_type: str
    sha256: SHA256Checksums | None
    version: str | None = None


class FileRead(Schema):
    id: UUID4
    organization_id: UUID4

    name: str
    extension: str
    version: str | None = None
    mime_type: str
    size: int
    sha256: SHA256Checksums | None

    status: str

    uploaded_at: datetime | None = None
    created_at: datetime
    modified_at: datetime | None = None

    @classmethod
    def prepare_dict_from_db(cls, record: File) -> dict[str, Any]:
        return dict(
            id=record.id,
            organization_id=record.organization_id,
            name=record.name,
            extension=record.extension,
            version=record.version,
            mime_type=record.mime_type,
            size=record.size,
            status=record.status,
            sha256=SHA256Checksums(
                base64=record.sha256_base64,
                hex=record.sha256_hex,
            ),
            uploaded_at=record.uploaded_at,
            created_at=record.created_at,
            modified_at=record.modified_at,
        )

    @classmethod
    def from_db(cls, record: File) -> Self:
        params = cls.prepare_dict_from_db(record)
        return cls(**params)


class FilePresignedRead(FileRead):
    url: str
    url_expires_at: datetime

    headers: dict[str, str] = {}

    @classmethod
    def from_presign(cls, record: File, url: str, expires_at: datetime) -> Self:
        params = cls.prepare_dict_from_db(record)
        params.update(
            dict(
                url=url,
                url_expires_at=expires_at,
                headers={
                    "Content-Disposition": get_disposition(record.name),
                    "Content-Type": record.mime_type,
                    "x-amz-checksum-sha256": record.sha256_base64,
                    "x-amz-sdk-checksum-algorithm": "SHA256",
                },
            )
        )
        if record.sha256_base64:
            params["headers"].update(
                {
                    "x-amz-meta-sha256-base64": record.sha256_base64,
                    "x-amz-meta-sha256-hex": record.sha256_hex,
                }
            )

        return cls(**params)


class FileUpdate(Schema):
    id: UUID4
    uploaded_at: datetime


class FilePermissionCreate(Schema):
    file_id: UUID4
    user_id: UUID4
    status: FilePermissionStatus


class FilePermissionUpdate(Schema):
    file_id: UUID4
    user_id: UUID4
    status: FilePermissionStatus

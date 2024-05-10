from datetime import datetime
from typing import Self

from pydantic import UUID4

from polar.kit.schemas import Schema
from polar.models import File


class FileCreate(Schema):
    organization_id: UUID4
    name: str
    size: int
    mime_type: str
    version: str | None = None


class FileRead(Schema):
    id: UUID4
    organization_id: UUID4

    name: str
    extension: str
    version: str | None = None
    mime_type: str
    size: int

    status: str

    uploaded_at: datetime | None = None
    created_at: datetime
    modified_at: datetime | None = None


class FilePresignedRead(FileRead):
    url: str
    url_expires_at: datetime

    @classmethod
    def from_presign(cls, record: File, url: str) -> Self:
        return cls(
            id=record.id,
            organization_id=record.organization_id,
            name=record.name,
            extension=record.extension,
            version=record.version,
            mime_type=record.mime_type,
            size=record.size,
            status=record.status,
            url=url,
            url_expires_at=record.presign_expires_at,
            uploaded_at=record.uploaded_at,
            created_at=record.created_at,
            modified_at=record.modified_at,
        )


class FileUpdate(Schema):
    id: UUID4
    uploaded_at: datetime

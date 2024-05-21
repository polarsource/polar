from datetime import datetime
from typing import Self

from pydantic import UUID4

from polar.file.schemas import FileRead as CreatorFileRead
from polar.integrations.aws.s3 import S3Service
from polar.kit.schemas import Schema
from polar.models import File
from polar.models.downloadable import DownloadableStatus


class DownloadableRead(CreatorFileRead): ...


class PresignedDownloadableRead(DownloadableRead):
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
                    "Content-Disposition": S3Service.downloadable_disposition(
                        record.name
                    ),
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


class DownloadableCreate(Schema):
    file_id: UUID4
    user_id: UUID4
    benefit_id: UUID4
    status: DownloadableStatus


class DownloadableUpdate(Schema):
    file_id: UUID4
    user_id: UUID4
    benefit_id: UUID4
    status: DownloadableStatus

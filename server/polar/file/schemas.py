import base64
import hashlib
from datetime import datetime
from typing import Any, Self

from pydantic import UUID4

from polar.kit.schemas import Schema
from polar.models import File
from polar.models.file_permission import FilePermissionStatus


def get_disposition(filename: str):
    return f'attachment; filename="{filename}"'


class FileCreateChecksum(Schema):
    sha256_base64: str


class FileCreatePart(Schema):
    number: int
    chunk_start: int
    chunk_end: int
    checksum: FileCreateChecksum | None

    def get_s3_arguments(self) -> dict[str, Any]:
        ret = dict(
            PartNumber=self.number,
        )
        if not self.checksum:
            return ret

        ret.update(
            dict(
                ChecksumAlgorithm="SHA256",
                ChecksumSHA256=self.checksum.sha256_base64,
            )
        )
        return ret


class FileCreateMultipart(Schema):
    parts: list[FileCreatePart]


class FileCreate(Schema):
    organization_id: UUID4
    name: str
    mime_type: str
    size: int
    checksum: FileCreateChecksum | None

    upload: FileCreateMultipart


class FileReadChecksum(Schema):
    etag: str | None = None
    sha256_base64: str | None
    sha256_hex: str | None


class FileRead(Schema):
    id: UUID4
    organization_id: UUID4

    name: str
    extension: str
    mime_type: str
    size: int
    checksum: FileReadChecksum

    uploaded_at: datetime | None = None
    created_at: datetime

    @staticmethod
    def prepare_dict_from_db(record: File) -> dict[str, Any]:
        ret = dict(
            id=record.id,
            organization_id=record.organization_id,
            name=record.name,
            extension=record.extension,
            mime_type=record.mime_type,
            size=record.size,
            uploaded_at=record.uploaded_at,
            created_at=record.created_at,
        )
        if record.sha256_base64 and record.sha256_hex:
            sha256 = dict(
                sha256_base64=record.sha256_base64,
                sha256_hex=record.sha256_hex,
            )
            ret["checksum"] = sha256

        return ret

    @classmethod
    def from_db(cls, record: File) -> Self:
        params = cls.prepare_dict_from_db(record)
        return cls(**params)


class FileUploadPart(FileCreatePart):
    url: str
    expires_at: datetime

    headers: dict[str, str] = {}

    @classmethod
    def generate_headers(cls, checksum: FileCreateChecksum | None) -> dict[str, str]:
        if not (checksum and checksum.sha256_base64):
            return {}

        return {
            "x-amz-checksum-sha256": checksum.sha256_base64,
            "x-amz-sdk-checksum-algorithm": "SHA256",
        }


class FileUploadMultipart(Schema):
    id: str
    parts: list[FileUploadPart]


class FileUpload(FileRead):
    upload: FileUploadMultipart

    @classmethod
    def from_presign(
        cls, record: File, upload_id: str, parts: list[FileUploadPart]
    ) -> Self:
        params = cls.prepare_dict_from_db(record)
        upload = FileUploadMultipart(id=upload_id, parts=parts)
        return cls(upload=upload, **params)


class FileUploadCompletedChecksum(Schema):
    etag: str
    sha256_base64: str | None = None


class FileUploadCompletedPart(Schema):
    number: int
    checksum: FileUploadCompletedChecksum


class FileUploadCompletedMultipart(Schema):
    id: str
    parts: list[FileUploadCompletedPart]


class FileUploadCompleted(Schema):
    upload: FileUploadCompletedMultipart

    def get_s3_arguments(self) -> dict[str, Any]:
        parts = []
        checksum_validate = []
        for part in self.upload.parts:
            data = dict(
                ETag=part.checksum.etag,
                PartNumber=part.number,
            )
            if part.checksum and part.checksum.sha256_base64:
                data["ChecksumSHA256"] = part.checksum.sha256_base64
                digest = base64.b64decode(part.checksum.sha256_base64)
                checksum_validate.append(digest)

            parts.append(data)

        ret = dict(
            UploadId=self.upload.id,
            MultipartUpload=dict(
                Parts=parts,
            ),
        )
        if not checksum_validate:
            return ret

        # S3 SHA-256 BASE64 validation for multipart upload is special.
        # It's not the same as SHA-256 BASE64 on the entire file contents.
        #
        # 1. Concatenates SHA-256 digests (not base64 encoded) from chunks
        # 2. New SHA-256 digest of the concatenation
        # 3. Base64 encode the new digest
        #
        # See: https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html
        # See: https://youtu.be/Te6s1VZPGfk?si=mnq2NizKJy_bM5-D&t=510
        #
        # We only use this for S3 validation. Our SHA-256 base64 & hexdigest in
        # the database is for the entire file contents to support regular
        # client-side validation post download.
        concatenated = b"".join(checksum_validate)
        digest = hashlib.sha256(concatenated).digest()
        ret["ChecksumSHA256"] = base64.b64encode(digest).decode("utf-8")
        return ret


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

import base64
import hashlib
from datetime import datetime
from typing import Any, Self

from pydantic import UUID4, computed_field

from polar.kit.schemas import IDSchema, Schema
from polar.kit.utils import human_readable_size
from polar.organization.schemas import OrganizationID


def get_downloadable_content_disposition(filename: str) -> str:
    return f'attachment; filename="{filename}"'


class S3FileCreatePart(Schema):
    number: int
    chunk_start: int
    chunk_end: int

    checksum_sha256_base64: str | None = None

    def get_boto3_arguments(self) -> dict[str, Any]:
        if not self.checksum_sha256_base64:
            return dict(PartNumber=self.number)

        return dict(
            PartNumber=self.number,
            ChecksumAlgorithm="SHA256",
            ChecksumSHA256=self.checksum_sha256_base64,
        )


class S3FileCreateMultipart(Schema):
    parts: list[S3FileCreatePart]


class S3FileCreate(Schema):
    organization_id: OrganizationID | None = None
    user_id: UUID4 | None = None
    name: str
    mime_type: str
    size: int

    checksum_sha256_base64: str | None = None

    upload: S3FileCreateMultipart


class S3File(IDSchema, validate_assignment=True):
    organization_id: UUID4 | None = None

    name: str
    path: str
    mime_type: str
    size: int

    # Provided by AWS S3
    storage_version: str | None
    checksum_etag: str | None

    # Provided by us
    checksum_sha256_base64: str | None
    checksum_sha256_hex: str | None

    last_modified_at: datetime | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def size_readable(self) -> str:
        return human_readable_size(self.size)

    def to_metadata(self) -> dict[str, str]:
        metadata = {
            "polar-id": str(self.id),
            "polar-name": self.name.encode("ascii", "ignore").decode("ascii"),
            "polar-size": str(self.size),
        }
        if self.organization_id:
            metadata["polar-organization-id"] = str(self.organization_id)
        if self.checksum_sha256_base64:
            metadata["polar-sha256-base64"] = self.checksum_sha256_base64
        if self.checksum_sha256_hex:
            metadata["polar-sha256-hex"] = self.checksum_sha256_hex
        return metadata

    @classmethod
    def from_head(cls, path: str, head: dict[str, Any]) -> Self:
        metadata = head.get("Metadata", {})

        return cls(
            id=metadata.get("polar-id"),
            organization_id=metadata.get("polar-organization-id"),
            name=metadata.get("polar-name"),
            path=path,
            mime_type=head["ContentType"],
            size=metadata.get("polar-size"),
            storage_version=head.get("VersionId", None),
            checksum_etag=head.get("ETag", None),
            checksum_sha256_base64=metadata.get("polar-sha256-base64"),
            checksum_sha256_hex=metadata.get("polar-sha256-hex"),
            last_modified_at=head.get("LastModified", None),
        )


class S3FileUploadPart(S3FileCreatePart):
    url: str
    expires_at: datetime

    headers: dict[str, str] = {}

    @classmethod
    def generate_headers(cls, sha256_base64: str | None) -> dict[str, str]:
        if not sha256_base64:
            return {}

        return {
            "x-amz-checksum-sha256": sha256_base64,
            "x-amz-sdk-checksum-algorithm": "SHA256",
        }


class S3FileUploadMultipart(Schema):
    id: str
    path: str
    parts: list[S3FileUploadPart]


class S3FileUpload(S3File):
    upload: S3FileUploadMultipart


class S3FileUploadCompletedPart(Schema):
    number: int
    checksum_etag: str
    checksum_sha256_base64: str | None


class S3FileUploadCompleted(Schema):
    id: str
    path: str
    parts: list[S3FileUploadCompletedPart]

    @staticmethod
    def generate_base64_multipart_checksum(checksum_digests: list[bytes]) -> str:
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
        concatenated = b"".join(checksum_digests)
        digest = hashlib.sha256(concatenated).digest()
        return base64.b64encode(digest).decode("utf-8")

    def get_boto3_arguments(self) -> dict[str, Any]:
        parts = []
        checksum_digests = []
        for part in self.parts:
            data = dict(
                ETag=part.checksum_etag,
                PartNumber=part.number,
            )
            if part.checksum_sha256_base64:
                data["ChecksumSHA256"] = part.checksum_sha256_base64
                digest = base64.b64decode(part.checksum_sha256_base64)
                checksum_digests.append(digest)

            parts.append(data)

        ret = dict(
            UploadId=self.id,
            MultipartUpload=dict(
                Parts=parts,
            ),
        )
        if not checksum_digests:
            return ret

        ret["ChecksumSHA256"] = self.generate_base64_multipart_checksum(
            checksum_digests
        )
        return ret


class S3FileUploadCompleteResponse(Schema):
    id: str
    path: str
    success: bool
    checksum_etag: str
    storage_version: str


class S3DownloadURL(Schema):
    url: str
    headers: dict[str, str] = {}
    expires_at: datetime


class S3FileDownload(S3File):
    download: S3DownloadURL

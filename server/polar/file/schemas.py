from datetime import datetime
from typing import Annotated, Any, Literal, Self

from pydantic import UUID4, Discriminator, Field, TypeAdapter, computed_field

from polar.integrations.aws.s3.schemas import (
    S3DownloadURL,
    S3File,
    S3FileCreate,
    S3FileDownload,
    S3FileUpload,
    S3FileUploadCompleted,
)
from polar.kit.schemas import ClassName, MergeJSONSchema, Schema, SetSchemaReference
from polar.models.file import File, FileServiceTypes

from .s3 import S3_SERVICES


class FileCreateBase(S3FileCreate):
    service: FileServiceTypes
    version: str | None = None


class DownloadableFileCreate(FileCreateBase):
    """Schema to create a file to be associated with the downloadables benefit."""

    service: Literal[FileServiceTypes.downloadable]


class ProductMediaFileCreate(FileCreateBase):
    """Schema to create a file to be used as a product media file."""

    service: Literal[FileServiceTypes.product_media]
    mime_type: str = Field(
        description=(
            "MIME type of the file. Only images are supported for this type of file."
        ),
        pattern=r"^image\/(jpeg|png|gif|webp|svg\+xml)$",
    )
    size: int = Field(
        description=(
            "Size of the file. A maximum of 10 MB is allowed for this type of file."
        ),
        le=10 * 1024 * 1024,
    )


class OrganizationAvatarFileCreate(FileCreateBase):
    """Schema to create a file to be used as an organization avatar."""

    service: Literal[FileServiceTypes.organization_avatar]
    mime_type: str = Field(
        description=(
            "MIME type of the file. Only images are supported for this type of file."
        ),
        pattern=r"^image\/(jpeg|png|gif|webp|svg\+xml)$",
    )
    size: int = Field(
        description=(
            "Size of the file. A maximum of 1 MB is allowed for this type of file."
        ),
        le=1 * 1024 * 1024,
    )


FileCreate = Annotated[
    DownloadableFileCreate | ProductMediaFileCreate | OrganizationAvatarFileCreate,
    Discriminator("service"),
    SetSchemaReference("FileCreate"),
]


class FileReadBase(S3File):
    version: str | None
    service: FileServiceTypes
    is_uploaded: bool
    created_at: datetime


class DownloadableFileRead(FileReadBase):
    """File to be associated with the downloadables benefit."""

    service: Literal[FileServiceTypes.downloadable]


class PublicFileReadBase(FileReadBase):
    @computed_field  # type: ignore[prop-decorator]
    @property
    def public_url(self) -> str:
        return S3_SERVICES[self.service].get_public_url(self.path)


class ProductMediaFileRead(PublicFileReadBase):
    """File to be used as a product media file."""

    service: Literal[FileServiceTypes.product_media]


class OrganizationAvatarFileRead(PublicFileReadBase):
    """File to be used as an organization avatar."""

    service: Literal[FileServiceTypes.organization_avatar]


FileRead = Annotated[
    DownloadableFileRead | ProductMediaFileRead | OrganizationAvatarFileRead,
    Discriminator("service"),
    MergeJSONSchema({"title": "FileRead"}),
    ClassName("FileRead"),
]

FileReadAdapter: TypeAdapter[FileRead] = TypeAdapter[FileRead](FileRead)


class FileUpload(S3FileUpload):
    version: str | None
    is_uploaded: bool = False
    service: FileServiceTypes


class FileUploadCompleted(S3FileUploadCompleted): ...


class FileDownload(S3FileDownload):
    version: str | None
    is_uploaded: bool
    service: FileServiceTypes

    @classmethod
    def from_presigned(cls, file: File, url: str, expires_at: datetime) -> Self:
        file_dict: dict[str, Any] = dict(
            id=file.id,
            organization_id=file.organization_id,
            name=file.name,
            path=file.path,
            mime_type=file.mime_type,
            size=file.size,
            version=file.version,
            service=file.service,
            checksum_etag=file.checksum_etag,
            last_modified_at=file.last_modified_at,
            storage_version=file.storage_version,
            is_uploaded=file.is_uploaded,
            created_at=file.created_at,
            checksum_sha256_base64=file.checksum_sha256_base64,
            checksum_sha256_hex=file.checksum_sha256_hex,
        )

        return cls(
            **file_dict,
            download=S3DownloadURL(
                url=url,
                expires_at=expires_at,
            ),
        )


class FileUpdate(Schema):
    id: UUID4
    version: str | None
    checksum_etag: str
    last_modified_at: datetime
    storage_version: str | None
    checksum_sha256_base64: str | None
    checksum_sha256_hex: str | None


class FilePatch(Schema):
    name: str | None = None
    version: str | None = None

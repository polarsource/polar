from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import (
        Organization,
    )


class FileServiceTypes(StrEnum):
    downloadable = "downloadable"
    product_media = "product_media"
    organization_avatar = "organization_avatar"


class File(RecordModel):
    __tablename__ = "files"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str | None] = mapped_column(String, nullable=True)
    path: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)

    service: Mapped[FileServiceTypes] = mapped_column(String, nullable=False)

    last_modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    storage_version: Mapped[str | None] = mapped_column(String, nullable=True)
    checksum_etag: Mapped[str | None] = mapped_column(String, nullable=True)
    checksum_sha256_base64: Mapped[str | None] = mapped_column(String, nullable=True)
    checksum_sha256_hex: Mapped[str | None] = mapped_column(String, nullable=True)

    is_uploaded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Flag for Polar to disable consumption of file
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __mapper_args__ = {
        "polymorphic_on": "service",
    }


class DownloadableFile(File):
    __mapper_args__ = {
        "polymorphic_identity": FileServiceTypes.downloadable,
    }


class ProductMediaFile(File):
    __mapper_args__ = {
        "polymorphic_identity": FileServiceTypes.product_media,
    }


class OrganizationAvatarFile(File):
    __mapper_args__ = {
        "polymorphic_identity": FileServiceTypes.organization_avatar,
    }

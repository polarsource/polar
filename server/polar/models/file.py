from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ForeignKey,
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
        User,
    )


class FileServiceTypes(StrEnum):
    downloadable = "downloadable"
    product_media = "product_media"
    organization_avatar = "organization_avatar"
    oauth_logo = "oauth_logo"


class File(RecordModel):
    __tablename__ = "files"

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str | None] = mapped_column(String, nullable=True)
    path: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)

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


class OAuthLogoFile(File):
    __mapper_args__ = {
        "polymorphic_identity": FileServiceTypes.oauth_logo,
    }

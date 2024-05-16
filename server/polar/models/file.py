from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from polar.models import (
        Organization,
    )


class FileExtension(StrEnum):
    jpg = "jpg"
    jpeg = "jpeg"
    gif = "gif"
    png = "png"


class File(RecordModel):
    __tablename__ = "files"

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    name: Mapped[str] = mapped_column(String, nullable=False)
    extension: Mapped[FileExtension] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=True)
    path: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)

    upload_id: Mapped[str] = mapped_column(
        String,
        nullable=True,
    )

    presigned_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=utc_now,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    s3_version_id: Mapped[str] = mapped_column(String, nullable=True)
    sha256_base64: Mapped[str] = mapped_column(String, nullable=True)
    sha256_hex: Mapped[str] = mapped_column(String, nullable=True)
    etag: Mapped[str] = mapped_column(String, nullable=True)

    @hybrid_property
    def uploaded(self) -> bool:
        return self.uploaded_at is not None


__all__ = ("File", "FileExtension")

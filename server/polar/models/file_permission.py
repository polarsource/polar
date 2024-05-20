from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

from .file import File
from .user import User


class FilePermissionStatus(StrEnum):
    granted = "granted"
    revoked = "revoked"


class FilePermission(RecordModel):
    __tablename__ = "file_permissions"
    __table_args__ = (UniqueConstraint("user_id", "file_id", "benefit_id"),)

    file_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("files.id"), nullable=False, index=True
    )

    @declared_attr
    def file(cls) -> Mapped[File]:
        return relationship(File, lazy="raise")

    status: Mapped[FilePermissionStatus] = mapped_column(String, nullable=False)

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship("User", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    downloaded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    latest_download_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

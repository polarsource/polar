from datetime import datetime
from uuid import UUID

from citext import CIText
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.enums import Platforms
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum
from polar.kit.extensions.sqlalchemy.types import PostgresUUID


class ExternalOrganization(RecordModel):
    __tablename__ = "external_organizations"
    __table_args__ = (
        UniqueConstraint("name", "platform"),
        UniqueConstraint("external_id"),
        UniqueConstraint("installation_id"),
    )

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(CIText(), nullable=False, unique=True)
    external_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    avatar_url: Mapped[str] = mapped_column(String, nullable=False)
    is_personal: Mapped[bool] = mapped_column(Boolean, nullable=False)

    #
    # GitHub App Fields
    #
    installation_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, unique=True
    )
    installation_created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    installation_updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    installation_suspended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # This column is unused
    installation_suspended_by: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # This column is unused
    installation_suspender: Mapped[UUID | None] = mapped_column(
        PostgresUUID, nullable=True, default=None
    )

    installation_permissions: Mapped[dict[str, str] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    #
    # End GitHub App Fields
    #

    #
    # Fields synced from GitHub
    #

    # Org description or user bio
    bio: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    pretty_name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    company: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    blog: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    location: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    email: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    twitter_username: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    #
    # End: Fields synced from GitHub
    #

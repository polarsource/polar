from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.enums import Platforms
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

from .external_organization import ExternalOrganization


class Repository(RecordModel):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("organization_id", "name"),
        Index("idx_deleted_at_is_private", "deleted_at", "is_private"),
    )

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    external_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("external_organizations.id"), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped[ExternalOrganization]:
        return relationship(ExternalOrganization, lazy="raise")

    name: Mapped[str] = mapped_column(CITEXT(), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    open_issues: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    watchers: Mapped[int | None] = mapped_column(Integer, nullable=True)

    main_branch: Mapped[str | None] = mapped_column(String, nullable=True)
    topics: Mapped[list[str] | None] = mapped_column(
        JSONB, nullable=False, default=list
    )

    license: Mapped[str | None] = mapped_column(String, nullable=True)
    homepage: Mapped[str | None] = mapped_column(String, nullable=True)

    repository_pushed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    repository_created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    repository_modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    issues_references_synced_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    profile_settings: Mapped[dict[str, Any]] = mapped_column(
        "profile_settings", JSONB, nullable=False, default=dict
    )

    # Automatically badge all new issues
    pledge_badge_auto_embed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    pledge_badge_label: Mapped[str] = mapped_column(
        String, nullable=False, default=settings.GITHUB_BADGE_EMBED_DEFAULT_LABEL
    )

    ###############################################################################
    # FEATURE & STATUS FLAGS
    ###############################################################################

    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_fork: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    is_issues_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_projects_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_wiki_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_pages_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_downloads_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    is_archived: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_disabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

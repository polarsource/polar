from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum
from polar.enums import Platforms

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization


class Repository(RecordModel):
    class Visibility(Enum):
        PUBLIC = "public"
        PRIVATE = "private"

    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("organization_id", "name"),
    )

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=True
    )

    organization: "Mapped[Organization]" = relationship(
        "Organization",
        back_populates="repos",
        lazy="joined",
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True)

    open_issues: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    watchers: Mapped[int | None] = mapped_column(Integer, nullable=True)

    main_branch: Mapped[str | None] = mapped_column(String, nullable=True)
    topics: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=list)

    license: Mapped[str | None] = mapped_column(String(50), nullable=True)
    homepage: Mapped[str | None] = mapped_column(String(128), nullable=True)

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
        TIMESTAMP(timezone=True), nullable=True
    )

    # Badge issues in this repository?
    pledge_badge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

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

    @hybrid_property
    def visibility(self) -> Visibility:
        if not self.is_private:
            return self.Visibility.PUBLIC
        return self.Visibility.PRIVATE

    __mutables__ = {
        "name",
        "description",
        "open_issues",
        "forks",
        "stars",
        "watchers",
        "main_branch",
        "topics",
        "license",
        "homepage",
        "repository_pushed_at",
        "repository_modified_at",
        "is_private",
        "is_fork",
        "is_issues_enabled",
        "is_wiki_enabled",
        "is_pages_enabled",
        "is_downloads_enabled",
        "is_archived",
        "is_disabled",
    }

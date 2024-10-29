from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import Platforms
from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization


class NotInstalledExternalOrganization(PolarError):
    def __init__(self) -> None:
        super().__init__("This external organization is not installed.")


class NotLinkedOrganization(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This external organization is not linked to a Polar organization."
        )


class ExternalOrganization(RecordModel):
    __tablename__ = "external_organizations"
    __table_args__ = (
        UniqueConstraint("name", "platform"),
        UniqueConstraint("external_id"),
        UniqueConstraint("installation_id"),
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(CITEXT(), nullable=False, unique=True)
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
        Uuid, nullable=True, default=None
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

    @property
    def safe_installation_id(self) -> int:
        if self.installation_id is None:
            raise NotInstalledExternalOrganization()
        return self.installation_id

    @property
    def safe_organization(self) -> "Organization":
        if self.organization is None:
            raise NotLinkedOrganization()
        return self.organization

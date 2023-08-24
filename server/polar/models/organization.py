from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from citext import CIText
from sqlalchemy import TIMESTAMP, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.config import settings
from polar.enums import Platforms
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.repository import Repository


class Organization(RecordModel):
    class Status(Enum):
        INACTIVE = "inactive"
        ACTIVE = "active"
        SUSPENDED = "suspended"

    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("name"),
        UniqueConstraint("external_id"),
        UniqueConstraint("installation_id"),
    )

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(CIText(), nullable=False, unique=True)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    avatar_url: Mapped[str] = mapped_column(String, nullable=False)
    is_personal: Mapped[bool] = mapped_column(Boolean, nullable=False)

    installation_id: Mapped[int] = mapped_column(Integer, nullable=True, unique=True)
    installation_created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    installation_updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    installation_suspended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    installation_suspended_by: Mapped[int | None] = mapped_column(Integer)
    installation_suspender: Mapped[UUID | None] = mapped_column(PostgresUUID)

    status: Mapped[Status] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.ACTIVE
    )

    # Whether to show pledged amount in the badge
    pledge_badge_show_amount: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    # Minimum amount required to pledge. Default to $20 (2000 cents)
    pledge_minimum_amount: Mapped[int] = mapped_column(
        Integer, nullable=False, default=settings.MINIMUM_ORG_PLEDGE_AMOUNT
    )

    default_badge_custom_content: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        default=None,
    )

    onboarded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(length=50), nullable=True, unique=True, default=None
    )

    billing_email: Mapped[str | None] = mapped_column(
        String(length=120), nullable=True, default=None
    )

    repos: "Mapped[list[Repository]]" = relationship(
        "Repository",
        back_populates="organization",
        uselist=True,
        lazy="raise",
    )

    # Org description or user bio
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    pretty_name: Mapped[str | None] = mapped_column(String, nullable=True)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    blog: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    twitter_username: Mapped[str | None] = mapped_column(String, nullable=True)

    @property
    def polar_site_url(self) -> str:
        return "{base}/{slug}".format(
            base=settings.FRONTEND_BASE_URL,
            slug=self.name,
        )

    __mutables__ = {
        "name",
        "avatar_url",
        "is_personal",
        "installation_id",
        "installation_created_at",
        "installation_updated_at",
        "installation_suspended_at",
        "status",
        "pledge_badge_show_amount",
        "pledge_minimum_amount",
        "deleted_at",
    }

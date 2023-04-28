from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.organization.signals import organization_created, organization_updated
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum
from polar.enums import Platforms

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.account import Account
    from polar.models.repository import Repository
    from polar.models.user import User


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

    on_created_signal = organization_created
    on_updated_signal = organization_updated

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(String(length=50), nullable=False, unique=True)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String)
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

    # Add badge to all historical & open issues before onboarding?
    pledge_badge_retroactive: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Whether to show pledged amount in the badge
    pledge_badge_show_amount: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    onboarded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    users: "Mapped[User]" = relationship(
        "UserOrganization",
        back_populates="organization",
        lazy="raise_on_sql",
    )

    account: "Mapped[Account | None]" = relationship(
        "Account", back_populates="organization", uselist=False, lazy="joined"
    )

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(length=50), nullable=True, unique=True, default=None
    )

    repos: "Mapped[list[Repository]]" = relationship(
        "Repository",
        back_populates="organization",
        uselist=True,
        lazy="raise",
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
        "pledge_badge_retroactive",
        "pledge_badge_show_amount",
    }

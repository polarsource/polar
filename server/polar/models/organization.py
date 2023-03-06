import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar import signals
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import GUID, StringEnum
from polar.platforms import Platforms

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

    on_created_signal = signals.organization_created
    on_updated_signal = signals.organization_updated

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    name: Mapped[str] = mapped_column(String(length=50), nullable=False, unique=True)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String)
    is_personal: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # TODO: Investigate what to do best with site_admin, i.e Github Enterprise
    is_site_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    installation_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    installation_created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    installation_updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True)
    )
    installation_suspended_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True)
    )
    installation_suspended_by: Mapped[int | None] = mapped_column(Integer)
    installation_suspender: Mapped[uuid.UUID | None] = mapped_column(GUID)

    status: Mapped[Status] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.INACTIVE
    )

    users: "Mapped[User]" = relationship(
        "UserOrganization",
        back_populates="organization",
        lazy="raise_on_sql",
    )

    account: "Mapped[Account]" = relationship(
        "Account", back_populates="organization", uselist=False, lazy="raise_on_sql"
    )

    repos: "Mapped[list[Repository]]" = relationship(
        "Repository",
        back_populates="organization",
        lazy="joined",
    )

    __mutables__ = {
        name,
        avatar_url,
        is_personal,
        is_site_admin,
        installation_id,
        installation_created_at,
        installation_updated_at,
        installation_suspended_at,
        status,
    }

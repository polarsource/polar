from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import StatusMixin, TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization
    from polar.models.user import User


class UserOrganization(TimestampedModel, StatusMixin):
    __tablename__ = "user_organizations"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    # Last time we validated with GitHub that this user can access this organization
    validated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
    )

    user: "Mapped[User]" = relationship(
        "User", back_populates="organization_associations", lazy="joined"
    )

    organization: "Mapped[Organization]" = relationship(
        "Organization", back_populates="users", lazy="joined"
    )

    __mutables__ = {"validated_at"}

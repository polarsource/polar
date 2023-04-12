from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization
    from polar.models.user import User


class UserOrganization(TimestampedModel):
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

    user: "Mapped[User]" = relationship(
        "User", back_populates="organization_associations", lazy="joined"
    )

    organization: "Mapped[Organization]" = relationship(
        "Organization", back_populates="users", lazy="joined"
    )

    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.extensions.sqlalchemy import GUID
from polar.kit.models import StatusMixin, TimestampedModel

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization
    from polar.models.user import User


class UserOrganization(TimestampedModel, StatusMixin):
    __tablename__ = "user_organizations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
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

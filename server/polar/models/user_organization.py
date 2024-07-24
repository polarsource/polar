from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.models.organization import Organization
from polar.models.user import User


class UserOrganization(TimestampedModel):
    __tablename__ = "user_organizations"

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    @declared_attr
    def user(cls) -> "Mapped[User]":
        return relationship("User", lazy="raise")

    @declared_attr
    def organization(cls) -> "Mapped[Organization]":
        return relationship("Organization", lazy="raise")

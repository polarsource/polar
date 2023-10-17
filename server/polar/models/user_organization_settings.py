from uuid import UUID

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class UserOrganizationSettings(TimestampedModel):
    __tablename__ = "user_organization_settings"

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

from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import StatusMixin, TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class UserRepository(TimestampedModel, StatusMixin):
    __tablename__ = "user_repositories"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    repository_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    # Last time we validated with GitHub that this user can access this organization
    validated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
    )

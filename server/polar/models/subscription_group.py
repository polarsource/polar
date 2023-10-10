from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Organization, Repository


class SubscriptionGroup(RecordModel):
    __tablename__ = "subscription_groups"

    name: Mapped[str] = mapped_column(String, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
    )
    organization: Mapped["Organization | None"] = relationship(
        "Organization", lazy="raise"
    )

    repository_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("repositories.id", ondelete="cascade"),
        nullable=True,
    )
    repository: Mapped["Repository | None"] = relationship("Repository", lazy="raise")

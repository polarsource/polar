from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Organization, Repository, SubscriptionTier


class SubscriptionGroup(RecordModel):
    __tablename__ = "subscription_groups"

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
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

    tiers: Mapped[list["SubscriptionTier"]] = relationship(
        "SubscriptionTier",
        lazy="raise",
        back_populates="subscription_group",
        order_by="SubscriptionTier.price_amount",
    )

    @property
    def managing_organization_id(self) -> UUID:
        if self.organization_id is not None:
            return self.organization_id
        if self.repository is not None:
            return self.repository.organization_id
        raise RuntimeError()

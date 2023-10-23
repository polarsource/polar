from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import (
        Organization,
        Repository,
        SubscriptionBenefit,
        SubscriptionTierBenefit,
    )


class SubscriptionTierType(StrEnum):
    hobby = "hobby"
    pro = "pro"
    business = "business"


class SubscriptionTier(RecordModel):
    __tablename__ = "subscription_tiers"

    type: Mapped[SubscriptionTierType] = mapped_column(
        String, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_highlighted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_product_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
    stripe_price_id: Mapped[str | None] = mapped_column(String, nullable=True)

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

    subscription_tier_benefits: Mapped[list["SubscriptionTierBenefit"]] = relationship(
        lazy="selectin",
        order_by="SubscriptionTierBenefit.order",
        cascade="all, delete-orphan",
    )

    benefits: AssociationProxy[list["SubscriptionBenefit"]] = association_proxy(
        "subscription_tier_benefits", "subscription_benefit"
    )

    @property
    def managing_organization_id(self) -> UUID:
        if self.organization_id is not None:
            return self.organization_id
        if self.repository is not None:
            return self.repository.organization_id
        raise RuntimeError()

    def get_stripe_name(self) -> str:
        if self.organization is not None:
            return f"{self.organization.name} - {self.name}"
        if self.repository is not None:
            return f"{self.repository.name} - {self.name}"
        raise RuntimeError()

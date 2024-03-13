from enum import StrEnum
from typing import TYPE_CHECKING, cast
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.subscription_benefit import (
    SubscriptionBenefitArticles,
    SubscriptionBenefitType,
)

if TYPE_CHECKING:
    from polar.models import (
        Organization,
        Repository,
        SubscriptionBenefit,
        SubscriptionTierBenefit,
        SubscriptionTierPrice,
    )


class SubscriptionTierType(StrEnum):
    free = "free"
    individual = "individual"
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
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_product_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    repository_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("repositories.id", ondelete="cascade"),
        nullable=True,
    )

    @declared_attr
    def repository(cls) -> Mapped["Repository | None"]:
        return relationship("Repository", lazy="raise")

    @declared_attr
    def all_prices(cls) -> Mapped[list["SubscriptionTierPrice"]]:
        # Prices are almost always needed, so eager loading makes sense
        return relationship(
            "SubscriptionTierPrice", lazy="raise", back_populates="subscription_tier"
        )

    @declared_attr
    def prices(cls) -> Mapped[list["SubscriptionTierPrice"]]:
        # Prices are almost always needed, so eager loading makes sense
        return relationship(
            "SubscriptionTierPrice",
            lazy="selectin",
            primaryjoin=(
                "and_("
                "SubscriptionTierPrice.subscription_tier_id == SubscriptionTier.id, "
                "SubscriptionTierPrice.is_archived.is_(False)"
                ")"
            ),
            viewonly=True,
        )

    subscription_tier_benefits: Mapped[list["SubscriptionTierBenefit"]] = relationship(
        # Benefits are almost always needed, so eager loading makes sense
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

    @property
    def is_tax_applicable(self) -> bool:
        if len(self.prices) == 0:
            return False

        for benefit in self.benefits:
            if benefit.is_tax_applicable:
                return True

        return False

    def get_stripe_name(self) -> str:
        if self.organization is not None:
            return f"{self.organization.name} - {self.name}"
        if self.repository is not None:
            return f"{self.repository.name} - {self.name}"
        raise RuntimeError()

    def get_articles_benefit(self) -> SubscriptionBenefitArticles | None:
        for benefit in self.benefits:
            if benefit.type == SubscriptionBenefitType.articles:
                return cast(SubscriptionBenefitArticles, benefit)
        return None

    def get_price(self, id: UUID) -> "SubscriptionTierPrice | None":
        for price in self.prices:
            if price.id == id:
                return price
        return None

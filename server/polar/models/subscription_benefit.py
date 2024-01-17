from enum import StrEnum
from typing import TYPE_CHECKING, TypedDict
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Organization, Repository


class TaxApplicationMustBeSpecified(PolarError):
    def __init__(self, type: "SubscriptionBenefitType") -> None:
        self.type = type
        message = "The tax application should be specified for this type."
        super().__init__(message)


class SubscriptionBenefitType(StrEnum):
    custom = "custom"
    articles = "articles"
    ads = "ads"

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict["SubscriptionBenefitType", bool] = {
                SubscriptionBenefitType.ads: True,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


class SubscriptionBenefitProperties(TypedDict):
    """Configurable properties for this benefit."""


class SubscriptionBenefitCustomProperties(SubscriptionBenefitProperties):
    note: str | None


class SubscriptionBenefitArticlesProperties(SubscriptionBenefitProperties):
    paid_articles: bool


class SubscriptionBenefitAdsProperties(SubscriptionBenefitProperties):
    pass


class SubscriptionBenefit(RecordModel):
    __tablename__ = "subscription_benefits"

    type: Mapped[SubscriptionBenefitType] = mapped_column(
        String, nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    selectable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deletable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    properties: Mapped[SubscriptionBenefitProperties] = mapped_column(
        "properties", JSONB, nullable=False, default=dict
    )

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

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class SubscriptionBenefitCustom(SubscriptionBenefit):
    properties: Mapped[SubscriptionBenefitCustomProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": SubscriptionBenefitType.custom,
        "polymorphic_load": "inline",
    }


class SubscriptionBenefitArticles(SubscriptionBenefit):
    properties: Mapped[SubscriptionBenefitArticlesProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": SubscriptionBenefitType.articles,
        "polymorphic_load": "inline",
    }


class SubscriptionBenefitAds(SubscriptionBenefit):
    properties: Mapped[SubscriptionBenefitAdsProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": SubscriptionBenefitType.ads,
        "polymorphic_load": "inline",
    }

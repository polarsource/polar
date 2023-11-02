from enum import StrEnum
from typing import TYPE_CHECKING, TypedDict, TypeVar
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    MappedAsDataclass,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.db.models.base import RecordModelNoDataClass
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
    builtin = "builtin"  # Temp type to demonstrate the API

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict["SubscriptionBenefitType", bool] = {
                SubscriptionBenefitType.builtin: True,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


class SubscriptionBenefitProperties(TypedDict):
    ...


class SubscriptionBenefitCustomProperties(SubscriptionBenefitProperties):
    ...


class SubscriptionBenefitBuiltinProperties(SubscriptionBenefitProperties):
    ...


M = TypeVar("M", bound=SubscriptionBenefitProperties)


class SubscriptionBenefit(RecordModelNoDataClass):
    __tablename__ = "subscription_benefits"

    type: Mapped[SubscriptionBenefitType] = mapped_column(
        String, nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    properties: Mapped[SubscriptionBenefitProperties] = mapped_column(
        "properties", JSONB, nullable=False, default=None, insert_default=dict
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

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class SubscriptionBenefitCustom(SubscriptionBenefit):
    properties: Mapped[SubscriptionBenefitCustomProperties] = mapped_column(
        use_existing_column=True, default=None, insert_default=dict
    )

    __mapper_args__ = {
        "polymorphic_identity": SubscriptionBenefitType.custom,
        "polymorphic_load": "inline",
    }


class SubscriptionBenefitBuiltin(SubscriptionBenefit):
    properties: Mapped[SubscriptionBenefitCustomProperties] = mapped_column(
        use_existing_column=True, default=None, insert_default=dict
    )

    __mapper_args__ = {
        "polymorphic_identity": SubscriptionBenefitType.builtin,
        "polymorphic_load": "inline",
    }

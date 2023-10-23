from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
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

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict["SubscriptionBenefitType", bool] = {
                # SubscriptionBenefitType.foo: True,
                # SubscriptionBenefitType.bar: False,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


class SubscriptionBenefit(RecordModel):
    __tablename__ = "subscription_benefits"

    type: Mapped[SubscriptionBenefitType] = mapped_column(
        String, nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
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

from typing import Annotated, Any, Literal

from annotated_types import Gt
from pydantic import Field, model_validator
from pydantic.types import UUID4

from polar.kit.schemas import Int32, Schema
from polar.kit.versioning import Version
from polar.models.benefit import BenefitType
from polar.version import V2027_01

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitPublicBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
    BenefitUpdateVisibilityMixin,
)
from .properties import BenefitMeterCreditAllocation

_ALLOCATION_DESCRIPTION = (
    "How the units are granted on seat-based products. "
    "`per_claimed_seat` grants the units for each claimed seat. "
    "`team` grants the units once per purchase, whatever the number of seats. "
    "In both cases, the units are credited to the billing customer. "
    "On products without seats, the units are always granted once per purchase."
)

Allocation = Annotated[
    BenefitMeterCreditAllocation,
    Version(starting_from=V2027_01),
    Field(description=_ALLOCATION_DESCRIPTION),
]


class BenefitMeterCreditReadPropertiesBase(Schema):
    @model_validator(mode="before")
    @classmethod
    def default_allocation(cls, data: Any) -> Any:
        # Benefits created before the allocation setting don't store it.
        if isinstance(data, dict) and "allocation" not in data:
            return {**data, "allocation": BenefitMeterCreditAllocation.per_claimed_seat}
        return data


class BenefitMeterCreditProperties(BenefitMeterCreditReadPropertiesBase):
    """
    Properties for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4
    allocation: Allocation


class BenefitMeterCreditCreateProperties(Schema):
    """
    Properties for creating a benefit of type `meter_unit`.
    """

    units: Annotated[Int32, Gt(0)]
    rollover: bool
    meter_id: UUID4
    allocation: Annotated[
        BenefitMeterCreditAllocation | None,
        Version(starting_from=V2027_01),
        Field(
            description=(
                f"{_ALLOCATION_DESCRIPTION} "
                "Defaults to `per_claimed_seat` on creation. "
                "On update, the current value is kept if omitted. "
                "It can't be changed once the benefit has been granted."
            )
        ),
    ] = None


class BenefitMeterCreditSubscriberProperties(BenefitMeterCreditReadPropertiesBase):
    """
    Properties available to subscribers for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4
    allocation: Allocation


class BenefitMeterCreditCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `meter_unit`.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditCreateProperties


class BenefitMeterCreditUpdate(BenefitUpdateVisibilityMixin, BenefitUpdateBase):
    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditCreateProperties | None = None


class BenefitMeterCredit(BenefitBase):
    """
    A benefit of type `meter_unit`.

    Use it to grant a number of units on a specific meter.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditProperties


class BenefitMeterCreditSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditSubscriberProperties


class BenefitMeterCreditPublicProperties(BenefitMeterCreditReadPropertiesBase):
    """
    Properties for a benefit of type `meter_credit`.
    """

    units: int
    meter_id: UUID4
    allocation: Allocation


class BenefitMeterCreditPublic(BenefitPublicBase):
    """
    A benefit of type `meter_credit`.

    Grants a number of units on a specific meter.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditPublicProperties

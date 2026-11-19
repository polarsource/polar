from typing import Annotated, Literal

from annotated_types import Gt
from pydantic import Field
from pydantic.types import UUID4

from polar.kit.schemas import Int32, Schema
from polar.models.benefit import BenefitType

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
    BenefitMeterCreditAllocation, Field(description=_ALLOCATION_DESCRIPTION)
]


class BenefitMeterCreditProperties(Schema):
    """
    Properties for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4
    allocation: Allocation = BenefitMeterCreditAllocation.per_claimed_seat


class BenefitMeterCreditCreateProperties(Schema):
    """
    Properties for creating a benefit of type `meter_unit`.
    """

    units: Annotated[Int32, Gt(0)]
    rollover: bool
    meter_id: UUID4
    allocation: Allocation = BenefitMeterCreditAllocation.per_claimed_seat


class BenefitMeterCreditUpdateProperties(Schema):
    """
    Properties for updating a benefit of type `meter_unit`.
    """

    units: Annotated[Int32, Gt(0)]
    rollover: bool
    meter_id: UUID4
    allocation: (
        Annotated[
            BenefitMeterCreditAllocation,
            Field(
                description=(
                    f"{_ALLOCATION_DESCRIPTION} "
                    "If omitted, the current value is kept. "
                    "It can't be changed once the benefit has been granted."
                )
            ),
        ]
        | None
    ) = None


class BenefitMeterCreditSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4
    allocation: Allocation = BenefitMeterCreditAllocation.per_claimed_seat


class BenefitMeterCreditCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `meter_unit`.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditCreateProperties


class BenefitMeterCreditUpdate(BenefitUpdateVisibilityMixin, BenefitUpdateBase):
    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditUpdateProperties | None = None


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


class BenefitMeterCreditPublicProperties(Schema):
    """
    Properties for a benefit of type `meter_credit`.
    """

    units: int
    meter_id: UUID4
    allocation: Allocation = BenefitMeterCreditAllocation.per_claimed_seat


class BenefitMeterCreditPublic(BenefitPublicBase):
    """
    A benefit of type `meter_credit`.

    Grants a number of units on a specific meter.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditPublicProperties

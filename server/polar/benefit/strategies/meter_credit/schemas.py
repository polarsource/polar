from typing import Annotated, Literal

from annotated_types import Gt, Le
from pydantic.types import UUID4

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)

INT_MAX_VALUE = 2_147_483_647


class BenefitMeterCreditProperties(Schema):
    """
    Properties for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4


class BenefitMeterCreditCreateProperties(Schema):
    """
    Properties for creating a benefit of type `meter_unit`.
    """

    units: Annotated[int, Gt(0), Le(INT_MAX_VALUE)]
    rollover: bool
    meter_id: UUID4


class BenefitMeterCreditSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `meter_unit`.
    """

    units: int
    rollover: bool
    meter_id: UUID4


class BenefitMeterCreditCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `meter_unit`.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditCreateProperties


class BenefitMeterCreditUpdate(BenefitUpdateBase):
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

from typing import Annotated, Literal

from annotated_types import Gt
from pydantic import Field
from pydantic.types import UUID4

from polar.kit.schemas import Int32, Schema
from polar.kit.versioning import Version
from polar.models.benefit import BenefitGrantTarget, BenefitType
from polar.version import V2027_01

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitPublicBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
    BenefitUpdateVisibilityMixin,
)


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

    units: Annotated[Int32, Gt(0)]
    rollover: bool
    meter_id: UUID4


GRANT_TARGET_DESCRIPTION = (
    "Who receives the credits on seat-based products. "
    "`member` credits the units for every claimed seat. "
    "`customer` credits the units once, as a pool shared by all seats. "
    "Products without seats always credit the customer. "
    "Can't be changed after creation."
)


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
    grant_target: Annotated[
        BenefitGrantTarget,
        Version(starting_from=V2027_01),
        Field(description=GRANT_TARGET_DESCRIPTION),
    ] = BenefitGrantTarget.member


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
    grant_target: Annotated[
        BenefitGrantTarget,
        Version(starting_from=V2027_01),
        Field(description=GRANT_TARGET_DESCRIPTION),
    ]


class BenefitMeterCreditSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditSubscriberProperties


class BenefitMeterCreditPublicProperties(Schema):
    """
    Properties for a benefit of type `meter_credit`.
    """

    units: int
    meter_id: UUID4


class BenefitMeterCreditPublic(BenefitPublicBase):
    """
    A benefit of type `meter_credit`.

    Grants a number of units on a specific meter.
    """

    type: Literal[BenefitType.meter_credit]
    properties: BenefitMeterCreditPublicProperties

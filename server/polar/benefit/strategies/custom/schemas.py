from typing import Annotated, Literal

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)

Note = Annotated[
    str | None,
    Field(
        description=(
            "Private note to be shared with customers who have this benefit granted."
        ),
    ),
]


class BenefitCustomProperties(Schema):
    """
    Properties for a benefit of type `custom`.
    """

    note: Note | None


class BenefitCustomCreateProperties(Schema):
    """
    Properties for creating a benefit of type `custom`.
    """

    note: Note | None = None


class BenefitCustomSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `custom`.
    """

    note: Note | None


class BenefitCustomCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `custom`.
    """

    type: Literal[BenefitType.custom]
    properties: BenefitCustomCreateProperties


class BenefitCustomUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomProperties | None = None


class BenefitCustom(BenefitBase):
    """
    A benefit of type `custom`.

    Use it to grant any kind of benefit that doesn't fit in the other types.
    """

    type: Literal[BenefitType.custom]
    properties: BenefitCustomProperties
    is_tax_applicable: bool = Field(deprecated=True)


class BenefitCustomSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomSubscriberProperties

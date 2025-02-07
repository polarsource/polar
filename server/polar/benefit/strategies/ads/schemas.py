from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)


class BenefitAdsProperties(Schema):
    """
    Properties for a benefit of type `ads`.
    """

    image_height: int = Field(400, description="The height of the displayed ad.")
    image_width: int = Field(400, description="The width of the displayed ad.")


class BenefitAdsCreate(BenefitCreateBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


class BenefitAdsUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties | None = None


class BenefitAds(BenefitBase):
    """
    A benefit of type `ads`.

    Use it so your backers can display ads on your README, website, etc.
    """

    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties


class BenefitGrantAdsSubscriberProperties(Schema):
    advertisement_campaign_id: UUID4 | None = Field(
        None,
        description="The ID of the enabled advertisement campaign for this benefit grant.",
    )


class BenefitAdsSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.ads]
    properties: BenefitAdsProperties

from typing import Literal
from uuid import UUID

from polar.kit.schemas import Schema


class AdvertisementCampaign(Schema):
    id: UUID
    subscription_id: UUID
    subscription_benefit_id: UUID

    views: int
    clicks: int

    image_url: str
    text: str
    link_url: str


class CreateAdvertisementCampaign(Schema):
    subscription_id: UUID
    subscription_benefit_id: UUID

    image_url: str
    text: str
    link_url: str


class EditAdvertisementCampaign(Schema):
    image_url: str
    text: str
    link_url: str

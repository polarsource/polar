from typing import Literal
from uuid import UUID

from polar.kit.schemas import Schema

AdvertisementCampaignFormat = Literal["rect", "small_leaderboard"]


class AdvertisementCampaign(Schema):
    id: UUID
    subscription_id: UUID

    format: AdvertisementCampaignFormat
    views: int
    clicks: int

    image_url: str
    text: str
    link_url: str


class CreateAdvertisementCampaign(Schema):
    subscription_id: UUID
    format: AdvertisementCampaignFormat
    image_url: str
    text: str
    link_url: str

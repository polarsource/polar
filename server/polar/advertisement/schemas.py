from uuid import UUID

from pydantic import HttpUrl

from polar.kit.schemas import Schema


class AdvertisementCampaign(Schema):
    id: UUID
    subscription_id: UUID
    subscription_benefit_id: UUID

    views: int
    clicks: int

    image_url: HttpUrl
    image_url_dark: HttpUrl | None = None

    text: str
    link_url: HttpUrl


class AdvertisementCampaignPublic(Schema):
    id: UUID

    image_url: HttpUrl
    image_url_dark: HttpUrl | None = None

    text: str
    link_url: HttpUrl


class CreateAdvertisementCampaign(Schema):
    subscription_id: UUID
    subscription_benefit_id: UUID

    image_url: HttpUrl
    image_url_dark: HttpUrl | None = None

    text: str
    link_url: HttpUrl


class EditAdvertisementCampaign(Schema):
    image_url: HttpUrl
    image_url_dark: HttpUrl | None = None
    text: str
    link_url: HttpUrl

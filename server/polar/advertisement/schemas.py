from pydantic import UUID4, HttpUrl

from polar.kit.schemas import TimestampedSchema


class AdvertisementCampaign(TimestampedSchema):
    id: UUID4
    image_url: HttpUrl
    image_url_dark: HttpUrl | None = None
    text: str
    link_url: HttpUrl

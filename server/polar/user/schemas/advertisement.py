from pydantic import UUID4, HttpUrl

from polar.benefit.schemas import BenefitID
from polar.kit.schemas import HttpUrlToStr, Schema, TimestampedSchema


class UserAdvertisementCampaign(TimestampedSchema):
    id: UUID4
    user_id: UUID4
    views: int
    clicks: int
    image_url: HttpUrl
    image_url_dark: HttpUrl | None
    text: str
    link_url: HttpUrl


class UserAdvertisementCampaignCreate(Schema):
    image_url: HttpUrlToStr
    image_url_dark: HttpUrlToStr | None = None

    text: str
    link_url: HttpUrlToStr


class UserAdvertisementCampaignUpdate(Schema):
    image_url: HttpUrlToStr | None = None
    image_url_dark: HttpUrlToStr | None = None
    text: str | None = None
    link_url: HttpUrlToStr | None = None


class UserAdvertisementCampaignEnable(Schema):
    benefit_id: BenefitID

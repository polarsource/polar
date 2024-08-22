from typing import Annotated

from pydantic import UUID4, Field, HttpUrl

from polar.kit.pagination import ListResource
from polar.kit.schemas import MergeJSONSchema, TimestampedSchema


class AdvertisementCampaign(TimestampedSchema):
    id: UUID4
    image_url: HttpUrl
    image_url_dark: HttpUrl | None
    text: str
    link_url: HttpUrl


Dimensions = Annotated[
    tuple[int, int],
    Field(
        description=(
            "The dimensions (width, height) in pixels of the advertisement images."
        )
    ),
    MergeJSONSchema({"items": {"type": "integer"}}),
]


class AdvertisementCampaignListResource(ListResource[AdvertisementCampaign]):
    dimensions: Dimensions

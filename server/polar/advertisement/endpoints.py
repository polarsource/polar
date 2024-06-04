from typing import Annotated

import structlog
from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import AdvertisementCampaign as AdvertisementCampaignModel
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import AdvertisementCampaign, AdvertisementCampaignListResource
from .service import SortProperty
from .service import advertisement_campaign as advertisement_campaign_service

log = structlog.get_logger()

router = APIRouter(tags=["advertisements"])

AdvertisementCampaignID = Annotated[
    UUID4, Path(description="The advertisement campaign ID.")
]
AdvertisementCampaignNotFound = {
    "description": "Advertisement campaign not found.",
    "model": ResourceNotFound.schema(),
}


ListSorting = Annotated[
    list[Sorting[SortProperty]],
    Depends(SortingGetter(SortProperty, ["granted_at"])),
]


@router.get("/", response_model=AdvertisementCampaignListResource, tags=[Tags.PUBLIC])
async def list_advertisement_campaigns(
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    benefit_id: UUID4 = Query(
        description="The benefit ID to look up advertisements for."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignListResource:
    """List active advertisement campaigns for a benefit."""
    results, count = await advertisement_campaign_service.list(
        session,
        benefit_id=benefit_id,
        pagination=pagination,
        sorting=sorting,
    )

    list_resource = ListResource.from_paginated_results(
        [
            AdvertisementCampaign.model_validate(advertisement_campaign)
            for advertisement_campaign, _ in results
        ],
        count,
        pagination,
    )
    benefit = results[0][1]
    return AdvertisementCampaignListResource(
        items=list_resource.items,
        pagination=list_resource.pagination,
        dimensions=(
            benefit.properties["image_width"],
            benefit.properties["image_height"],
        ),
    )


@router.get(
    "/{id}",
    response_model=AdvertisementCampaign,
    tags=[Tags.PUBLIC],
    responses={404: AdvertisementCampaignNotFound},
)
async def get_advertisement_campaign(
    id: AdvertisementCampaignID,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    """Get an advertisement campaign by ID."""
    advertisement_campaign = await advertisement_campaign_service.get_by_id(session, id)

    if advertisement_campaign is None:
        raise ResourceNotFound()

    return advertisement_campaign


@router.post(
    "/{id}/view",
    tags=[Tags.PUBLIC],
    status_code=204,
    responses={
        204: {"description": "The view was successfully tracked."},
        404: AdvertisementCampaignNotFound,
    },
)
async def track_advertisement_campaign_view(
    id: AdvertisementCampaignID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Track a view on an advertisement campaign."""
    advertisement_campaign = await advertisement_campaign_service.get_by_id(session, id)

    if advertisement_campaign is None:
        raise ResourceNotFound()

    await advertisement_campaign_service.track_view(session, advertisement_campaign)

    return None

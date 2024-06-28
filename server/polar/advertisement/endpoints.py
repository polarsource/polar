from typing import Annotated

import structlog
from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.benefit.service.benefit import benefit as benefit_service
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import AdvertisementCampaign as AdvertisementCampaignModel
from polar.models.benefit import BenefitAds
from polar.openapi import IN_DEVELOPMENT_ONLY, APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import AdvertisementCampaign, AdvertisementCampaignListResource
from .service import SortProperty
from .service import advertisement_campaign as advertisement_campaign_service

log = structlog.get_logger()

router = APIRouter(prefix="/advertisements", tags=["advertisements", APITag.documented])

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


@router.get(
    "/", summary="List Campaigns", response_model=AdvertisementCampaignListResource
)
async def list(
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    benefit_id: UUID4 = Query(
        description="The benefit ID to look up advertisements for."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignListResource:
    """List active advertisement campaigns for a benefit."""
    benefit = await benefit_service.get(session, benefit_id, class_=BenefitAds)
    if benefit is None:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("query", "benefit_id"),
                    "msg": "Benefit not found.",
                    "input": benefit_id,
                }
            ]
        )

    results, count = await advertisement_campaign_service.list(
        session,
        benefit_id=benefit.id,
        pagination=pagination,
        sorting=sorting,
    )

    list_resource = ListResource.from_paginated_results(
        [
            AdvertisementCampaign.model_validate(advertisement_campaign)
            for advertisement_campaign in results
        ],
        count,
        pagination,
    )

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
    summary="Get Campaign",
    response_model=AdvertisementCampaign,
    responses={404: AdvertisementCampaignNotFound},
)
async def get(
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
    summary="Track View",
    status_code=204,
    responses={
        204: {"description": "The view was successfully tracked."},
        404: AdvertisementCampaignNotFound,
    },
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def track_view(
    id: AdvertisementCampaignID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Track a view on an advertisement campaign."""
    advertisement_campaign = await advertisement_campaign_service.get_by_id(session, id)

    if advertisement_campaign is None:
        raise ResourceNotFound()

    await advertisement_campaign_service.track_view(session, advertisement_campaign)

    return None

from typing import Annotated

from fastapi import Depends, Path
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import AdvertisementCampaign
from polar.postgres import get_db_session
from polar.tags.api import Tags

from .. import auth
from ..schemas.advertisement import (
    UserAdvertisementCampaign,
    UserAdvertisementCampaignCreate,
    UserAdvertisementCampaignEnable,
    UserAdvertisementCampaignUpdate,
)
from ..service.advertisement import SortProperty
from ..service.advertisement import user_advertisement as user_advertisement_service

router = APIRouter(prefix="/advertisements")

AdvertisementCampaignID = Annotated[
    UUID4, Path(description="The advertisement campaign ID.")
]
AdvertisementCampaignNotFound = {
    "description": "Advertisement campaign not found.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[SortProperty]],
    Depends(SortingGetter(SortProperty, ["-created_at"])),
]


@router.get(
    "/", response_model=ListResource[UserAdvertisementCampaign], tags=[Tags.PUBLIC]
)
async def list_advertisement_campaigns(
    auth_subject: auth.UserAdvertisementCampaignsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[UserAdvertisementCampaign]:
    """List advertisement campaigns."""
    results, count = await user_advertisement_service.list(
        session,
        auth_subject,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [UserAdvertisementCampaign.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    response_model=UserAdvertisementCampaign,
    tags=[Tags.PUBLIC],
    responses={404: AdvertisementCampaignNotFound},
)
async def get_advertisement_campaign(
    id: AdvertisementCampaignID,
    auth_subject: auth.UserAdvertisementCampaignsRead,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    """Get an advertisement campaign by ID."""
    advertisement_campaign = await user_advertisement_service.get_by_id(
        session, auth_subject, id
    )

    if advertisement_campaign is None:
        raise ResourceNotFound()

    return advertisement_campaign


@router.post(
    "/",
    response_model=UserAdvertisementCampaign,
    tags=[Tags.PUBLIC],
    status_code=201,
    responses={201: {"description": "Advertisement campaign created."}},
)
async def create_advertisement_campaign(
    advertisement_campaign_create: UserAdvertisementCampaignCreate,
    auth_subject: auth.UserAdvertisementCampaignsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    """Create an advertisement campaign."""
    return await user_advertisement_service.create(
        session,
        auth_subject,
        advertisement_campaign_create=advertisement_campaign_create,
    )


@router.patch(
    "/{id}",
    response_model=UserAdvertisementCampaign,
    tags=[Tags.PUBLIC],
    responses={
        200: {"description": "Advertisement campaign  updated."},
        404: AdvertisementCampaignNotFound,
    },
)
async def update_advertisement_campaign(
    id: AdvertisementCampaignID,
    advertisement_campaign_update: UserAdvertisementCampaignUpdate,
    auth_subject: auth.UserAdvertisementCampaignsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    """Update an advertisement campaign."""
    advertisement_campaign = await user_advertisement_service.get_by_id(
        session, auth_subject, id
    )

    if advertisement_campaign is None:
        raise ResourceNotFound()

    return await user_advertisement_service.update(
        session,
        advertisement_campaign=advertisement_campaign,
        advertisement_campaign_update=advertisement_campaign_update,
    )


@router.post(
    "/{id}/enable",
    tags=[Tags.PUBLIC],
    status_code=202,
    responses={
        202: {"description": "Advertisement campaign enabled on benefit."},
        404: AdvertisementCampaignNotFound,
    },
)
async def enable_advertisement_campaign(
    id: AdvertisementCampaignID,
    advertisement_campaign_enable: UserAdvertisementCampaignEnable,
    auth_subject: auth.UserAdvertisementCampaignsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Enable an advertisement campaign on a granted benefit."""
    advertisement_campaign = await user_advertisement_service.get_by_id(
        session, auth_subject, id
    )

    if advertisement_campaign is None:
        raise ResourceNotFound()

    await user_advertisement_service.enable(
        session,
        auth_subject,
        advertisement_campaign=advertisement_campaign,
        advertisement_campaign_enable=advertisement_campaign_enable,
    )

    return None


@router.delete(
    "/{id}",
    tags=[Tags.PUBLIC],
    responses={
        204: {"description": "Advertisement campaign deleted."},
        404: AdvertisementCampaignNotFound,
    },
)
async def delete_advertisement_campaign(
    id: AdvertisementCampaignID,
    auth_subject: auth.UserAdvertisementCampaignsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete an advertisement campaign.

    It'll be automatically disabled on all granted benefits.
    """
    advertisement_campaign = await user_advertisement_service.get_by_id(
        session, auth_subject, id
    )

    if advertisement_campaign is None:
        raise ResourceNotFound()

    await user_advertisement_service.delete(
        session, advertisement_campaign=advertisement_campaign
    )

    return None

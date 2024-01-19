from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query

from polar.auth.dependencies import UserRequiredAuth
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, Pagination
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import (
    AdvertisementCampaign,
    CreateAdvertisementCampaign,
    EditAdvertisementCampaign,
)
from .service import advertisement_campaign_service

log = structlog.get_logger()

router = APIRouter(tags=["advertisements"])


@router.get(
    "/advertisements/campaigns/search",
    response_model=ListResource[AdvertisementCampaign],
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def search_campaigns(
    auth: UserRequiredAuth,
    subscription_id: UUID,
    subscription_benefit_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[AdvertisementCampaign]:
    ads = await advertisement_campaign_service.search(
        session,
        subscription_id=subscription_id,
        subscription_benefit_id=subscription_benefit_id,
    )

    return ListResource(
        items=[AdvertisementCampaign.model_validate(ad) for ad in ads],
        pagination=Pagination(total_count=len(ads), max_page=1),
    )


@router.post(
    "/advertisements/campaigns",
    response_model=AdvertisementCampaign,
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def create_campaign(
    create: CreateAdvertisementCampaign,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    # TODO: authz

    created = await advertisement_campaign_service.create(session, create)
    return AdvertisementCampaign.model_validate(created)


@router.post(
    "/advertisements/campaigns/{id}",
    response_model=AdvertisementCampaign,
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def edit_campaign(
    id: UUID,
    campaign: EditAdvertisementCampaign,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    # TODO: authz

    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    edited = await advertisement_campaign_service.edit(session, ad, campaign)
    return AdvertisementCampaign.model_validate(edited)


@router.delete(
    "/advertisements/campaigns/{id}",
    response_model=AdvertisementCampaign,
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def delete_campaign(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaign:
    # TODO: authz

    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    await advertisement_campaign_service.delete(session, ad)

    return AdvertisementCampaign.model_validate(ad)

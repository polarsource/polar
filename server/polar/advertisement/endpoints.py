from uuid import UUID

import structlog
from fastapi import Depends

from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound, Unauthorized
from polar.integrations.github.client import NotFound
from polar.kit.pagination import ListResource, Pagination
from polar.kit.routing import APIRouter
from polar.models.advertisement_campaign import (
    AdvertisementCampaign as AdvertisementCampaignModel,
)
from polar.models.subscription_benefit_grant import SubscriptionBenefitGrant
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.subscription.service.subscription import (
    subscription as subscription_service,
)
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from polar.subscription.service.subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)
from polar.tags.api import Tags

from .schemas import (
    AdvertisementCampaign,
    AdvertisementCampaignPublic,
    AdvertisementDisplay,
    CreateAdvertisementCampaign,
    EditAdvertisementCampaign,
)
from .service import advertisement_campaign_service

log = structlog.get_logger()

router = APIRouter(tags=["advertisements"])


async def _get_grant(
    session: AsyncSession,
    user: User,
    subscription_id: UUID,
    subscription_benefit_id: UUID,
) -> SubscriptionBenefitGrant | None:
    subscription = await subscription_service.get(session, subscription_id)
    if not subscription:
        raise NotFound()

    benefit = await subscription_benefit_service.get(session, subscription_benefit_id)
    if not benefit:
        raise NotFound()

    # Verify that the authed user has been granted this benefit for this subscription
    grant = (
        await subscription_benefit_grant_service.get_by_subscription_user_and_benefit(
            session,
            subscription=subscription,
            user=user,
            subscription_benefit=benefit,
        )
    )

    return grant


@router.get(
    "/advertisements/campaigns/search",
    response_model=ListResource[AdvertisementCampaign],
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def search_campaigns(
    auth: UserRequiredAuth,
    subscription_id: UUID | None = None,
    subscription_benefit_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[AdvertisementCampaign]:
    if subscription_id is None and subscription_benefit_id is None:
        raise BadRequest("No search criteria specified")

    # Authz
    # if searching by subscription_id and subscription_benefit_id, require an active grant
    if subscription_id and subscription_benefit_id:
        grant = await _get_grant(
            session, auth.user, subscription_id, subscription_benefit_id
        )
        if not grant or grant.revoked_at is not None:
            raise NotPermitted("This benefit does not exist or has been revoked")
    elif subscription_benefit_id:
        # searching by benefit, require user to be able to write the benefit
        benefit = await subscription_benefit_service.get(
            session,
            subscription_benefit_id,
            loaded=True,
        )
        if not benefit:
            raise NotFound()

        if not await authz.can(auth.subject, AccessType.write, benefit):
            raise Unauthorized()
    else:
        raise BadRequest()

    ads = await advertisement_campaign_service.search(
        session,
        subscription_id=subscription_id,
        subscription_benefit_id=subscription_benefit_id,
    )

    return ListResource(
        items=[AdvertisementCampaign.model_validate(ad) for ad in ads],
        pagination=Pagination(total_count=len(ads), max_page=1),
    )


@router.get(
    "/advertisements/display/search",
    response_model=ListResource[AdvertisementDisplay],
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def search_display(
    subscription_benefit_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[AdvertisementDisplay]:
    if subscription_benefit_id is None:
        raise BadRequest("No search criteria specified")

    ads = await advertisement_campaign_service.search(
        session,
        subscription_benefit_id=subscription_benefit_id,
    )

    benefit = await subscription_benefit_service.get(session, subscription_benefit_id)
    if not benefit:
        raise ResourceNotFound()

    def withDimensions(a: AdvertisementDisplay) -> AdvertisementDisplay:
        h = benefit.properties.get("image_height", 100)
        w = benefit.properties.get("image_width", 100)
        a.height = h if isinstance(h, int) else 100
        a.width = w if isinstance(w, int) else 100
        return a

    return ListResource(
        items=[
            withDimensions(
                AdvertisementDisplay.model_validate(
                    ad,
                )
            )
            for ad in ads
        ],
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
) -> AdvertisementCampaignModel:
    grant = await _get_grant(
        session, auth.user, create.subscription_id, create.subscription_benefit_id
    )
    if not grant or grant.revoked_at is not None:
        raise NotPermitted("This benefit does not exist or has been revoked")

    created = await advertisement_campaign_service.create(session, create)
    return created


@router.get(
    "/advertisements/campaigns/{id}",
    response_model=AdvertisementCampaign,
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def get_campaign(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    grant = await _get_grant(
        session, auth.user, ad.subscription_id, ad.subscription_benefit_id
    )
    if not grant or grant.revoked_at is not None:
        raise NotPermitted("This benefit does not exist or has been revoked")

    return ad


@router.post(
    "/advertisements/campaigns/{id}/track_view",
    response_model=AdvertisementCampaignPublic,
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def track_view(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    await advertisement_campaign_service.track_view(session, ad)

    return ad


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
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    grant = await _get_grant(
        session, auth.user, ad.subscription_id, ad.subscription_benefit_id
    )
    if not grant or grant.revoked_at is not None:
        raise NotPermitted("This benefit does not exist or has been revoked")

    edited = await advertisement_campaign_service.edit(session, ad, campaign)
    return edited


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
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    subscription = await subscription_service.get(session, ad.subscription_id)
    if not subscription:
        raise NotFound()

    benefit = await subscription_benefit_service.get(
        session, ad.subscription_benefit_id
    )
    if not benefit:
        raise NotFound()

    # Verify that the authed user has been granted this benefit for this subscription
    grant = (
        await subscription_benefit_grant_service.get_by_subscription_user_and_benefit(
            session,
            subscription=subscription,
            user=auth.user,
            subscription_benefit=benefit,
        )
    )
    if not grant or grant.revoked_at is not None:
        raise NotPermitted("This benefit does not exist or has been revoked")

    await advertisement_campaign_service.delete(session, ad)

    return ad

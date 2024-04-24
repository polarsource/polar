from uuid import UUID

import structlog
from fastapi import Depends

from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.benefit.service.benefit import benefit as benefit_service
from polar.benefit.service.benefit_grant import (
    benefit_grant as benefit_grant_service,
)
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound, Unauthorized
from polar.integrations.github.client import NotFound
from polar.kit.pagination import ListResource, Pagination
from polar.kit.routing import APIRouter
from polar.models import BenefitGrant
from polar.models.advertisement_campaign import (
    AdvertisementCampaign as AdvertisementCampaignModel,
)
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.subscription.service.subscription import (
    subscription as subscription_service,
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
    benefit_id: UUID,
) -> BenefitGrant | None:
    subscription = await subscription_service.get(session, subscription_id)
    if not subscription:
        raise NotFound()

    benefit = await benefit_service.get(session, benefit_id)
    if not benefit:
        raise NotFound()

    # Verify that the authed user has been granted this benefit for this subscription
    grant = await benefit_grant_service.get_by_benefit_and_scope(
        session, user=user, benefit=benefit, subscription=subscription
    )

    return grant


@router.get(
    "/advertisements/campaigns/search",
    response_model=ListResource[AdvertisementCampaign],
    tags=[Tags.PUBLIC],
    status_code=200,
)
async def search_campaigns(
    auth_subject: WebUser,
    subscription_id: UUID | None = None,
    benefit_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[AdvertisementCampaign]:
    if subscription_id is None and benefit_id is None:
        raise BadRequest("No search criteria specified")

    # Authz
    # if searching by subscription_id and benefit_id, require an active grant
    if subscription_id and benefit_id:
        grant = await _get_grant(
            session, auth_subject.subject, subscription_id, benefit_id
        )
        if not grant or grant.revoked_at is not None:
            raise NotPermitted("This benefit does not exist or has been revoked")
    elif benefit_id:
        # searching by benefit, require user to be able to write the benefit
        benefit = await benefit_service.get(
            session,
            benefit_id,
            loaded=True,
        )
        if not benefit:
            raise NotFound()

        if not await authz.can(auth_subject.subject, AccessType.write, benefit):
            raise Unauthorized()
    else:
        raise BadRequest()

    ads = await advertisement_campaign_service.search(
        session,
        subscription_id=subscription_id,
        benefit_id=benefit_id,
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
    benefit_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[AdvertisementDisplay]:
    if benefit_id is None:
        raise BadRequest("No search criteria specified")

    ads = await advertisement_campaign_service.search(
        session,
        benefit_id=benefit_id,
    )

    benefit = await benefit_service.get(session, benefit_id)
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
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    grant = await _get_grant(
        session, auth_subject.subject, create.subscription_id, create.benefit_id
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
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    grant = await _get_grant(
        session, auth_subject.subject, ad.subscription_id, ad.benefit_id
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
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    grant = await _get_grant(
        session, auth_subject.subject, ad.subscription_id, ad.benefit_id
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
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> AdvertisementCampaignModel:
    ad = await advertisement_campaign_service.get(session, id)
    if not ad:
        raise ResourceNotFound()

    subscription = await subscription_service.get(session, ad.subscription_id)
    if not subscription:
        raise NotFound()

    benefit = await benefit_service.get(session, ad.benefit_id)
    if not benefit:
        raise NotFound()

    # Verify that the authed user has been granted this benefit for this subscription
    grant = await benefit_grant_service.get_by_benefit_and_scope(
        session, user=auth_subject.subject, benefit=benefit, subscription=subscription
    )
    if not grant or grant.revoked_at is not None:
        raise NotPermitted("This benefit does not exist or has been revoked")

    await advertisement_campaign_service.delete(session, ad)

    return ad

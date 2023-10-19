from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import UUID4

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import Authz
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Repository, SubscriptionTier
from polar.models.subscription_tier import SubscriptionTierType
from polar.organization.dependencies import OrganizationNameQuery
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags

from .schemas import (
    SubscribeSession,
    SubscribeSessionCreate,
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
)
from .schemas import SubscriptionTier as SubscriptionTierSchema
from .service.subscription_tier import subscription_tier as subscription_tier_service


async def is_feature_flag_enabled(auth: UserRequiredAuth) -> None:
    if posthog.client and not posthog.client.feature_enabled(
        "subscriptions", auth.user.posthog_distinct_id
    ):
        raise HTTPException(403, "You don't have access to this feature.")


router = APIRouter(
    prefix="/subscriptions",
    tags=["subscriptions"],
    dependencies=[Depends(is_feature_flag_enabled)],
)


@router.get(
    "/tiers/search",
    response_model=ListResource[SubscriptionTierSchema],
    tags=[Tags.PUBLIC],
)
async def search_subscription_tiers(
    pagination: PaginationParamsQuery,
    organization_name: OrganizationNameQuery,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    show_archived: bool = Query(False),
    type: SubscriptionTierType | None = Query(None),
    platform: Platforms = Query(...),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[SubscriptionTierSchema]:
    organization = await organization_service.get_by_name(
        session, platform, organization_name
    )
    if organization is None:
        raise ResourceNotFound("Organization not found")

    repository: Repository | None = None
    if repository_name is not None:
        repository = await repository_service.get_by_org_and_name(
            session, organization.id, repository_name
        )
        if repository is None:
            raise ResourceNotFound("Repository not found")

    results, count = await subscription_tier_service.search(
        session,
        auth.subject,
        type=type,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        show_archived=show_archived,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SubscriptionTierSchema.from_orm(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/tiers/lookup",
    response_model=SubscriptionTierSchema,
    tags=[Tags.PUBLIC],
)
async def lookup_subscription_tier(
    subscription_tier_id: UUID4,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionTier:
    subscription_tier = await subscription_tier_service.get_by_id(
        session, auth.subject, subscription_tier_id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return subscription_tier


@router.post(
    "/tiers/",
    response_model=SubscriptionTierSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_subscription_tier(
    subscription_tier_create: SubscriptionTierCreate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionTier:
    return await subscription_tier_service.user_create(
        session, authz, subscription_tier_create, auth.user
    )


@router.post("/tiers/{id}", response_model=SubscriptionTierSchema, tags=[Tags.PUBLIC])
async def update_subscription_tier(
    id: UUID4,
    subscription_tier_update: SubscriptionTierUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionTier:
    subscription_tier = await subscription_tier_service.get_by_id(
        session, auth.subject, id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return await subscription_tier_service.user_update(
        session, authz, subscription_tier, subscription_tier_update, auth.user
    )


@router.post(
    "/tiers/{id}/archive", response_model=SubscriptionTierSchema, tags=[Tags.PUBLIC]
)
async def archive_subscription_tier(
    id: UUID4,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionTier:
    subscription_tier = await subscription_tier_service.get_by_id(
        session, auth.subject, id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return await subscription_tier_service.archive(
        session, authz, subscription_tier, auth.user
    )


@router.post(
    "/subscribe-sessions/",
    response_model=SubscribeSession,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_subscribe_session(
    session_create: SubscribeSessionCreate,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> SubscribeSession:
    subscription_tier = await subscription_tier_service.get(
        session, session_create.tier_id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return await subscription_tier_service.create_subscribe_session(
        session,
        subscription_tier,
        session_create.success_url,
        auth.subject,
        auth.auth_method,
        customer_email=session_create.customer_email,
    )


@router.get(
    "/subscribe-sessions/{id}",
    response_model=SubscribeSession,
    tags=[Tags.PUBLIC],
)
async def get_subscribe_session(
    id: str,
    session: AsyncSession = Depends(get_db_session),
) -> SubscribeSession:
    return await subscription_tier_service.get_subscribe_session(session, id)

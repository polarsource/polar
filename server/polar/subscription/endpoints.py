from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import UUID4, AnyHttpUrl, EmailStr

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Repository, SubscriptionGroup, SubscriptionTier, User
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
    SubscriptionGroupInitialize,
    SubscriptionGroupUpdate,
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
)
from .schemas import SubscriptionGroup as SubscriptionGroupSchema
from .schemas import SubscriptionTier as SubscriptionTierSchema
from .service.subscription_group import subscription_group as subscription_group_service
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
    "/groups/search",
    response_model=ListResource[SubscriptionGroupSchema],
    tags=[Tags.PUBLIC],
)
async def search_subscription_groups(
    pagination: PaginationParamsQuery,
    organization_name: OrganizationNameQuery,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    platform: Platforms = Query(...),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[SubscriptionGroupSchema]:
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

    results, count = await subscription_group_service.search(
        session,
        auth.subject,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SubscriptionGroupSchema.from_orm(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/groups/lookup", response_model=SubscriptionGroupSchema, tags=[Tags.PUBLIC]
)
async def lookup_subscription_group(
    subscription_group_id: UUID4,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    subscription_group = await subscription_group_service.get_by_id(
        session, auth.subject, subscription_group_id
    )

    if subscription_group is None:
        raise ResourceNotFound()

    return subscription_group


@router.post(
    "/groups/initialize",
    response_model=ListResource[SubscriptionGroupSchema],
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def initialize_subscription_groups(
    subscription_group_initialize: SubscriptionGroupInitialize,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionGroupSchema]:
    subscription_groups = await subscription_group_service.initialize(
        session, authz, subscription_group_initialize, auth.user
    )
    return ListResource(
        items=[
            SubscriptionGroupSchema.from_orm(subscription_group)
            for subscription_group in subscription_groups
        ],
        pagination=Pagination(total_count=len(subscription_groups), max_page=1),
    )


@router.post("/groups/{id}", response_model=SubscriptionGroupSchema, tags=[Tags.PUBLIC])
async def update_subscription_group(
    id: UUID4,
    subscription_group_update: SubscriptionGroupUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    subscription_group = (
        await subscription_group_service.get_with_organization_or_repository(
            session, id
        )
    )

    if subscription_group is None:
        raise ResourceNotFound()

    if not await authz.can(auth.user, AccessType.write, subscription_group):
        raise NotPermitted()

    subscription_group = await subscription_group_service.update(
        session, subscription_group, subscription_group_update, exclude_unset=True
    )
    await session.refresh(subscription_group, {"tiers"})
    return subscription_group


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
    subscription_tier = await subscription_tier_service.get(session, id)

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
    subscription_tier = await subscription_tier_service.get(session, id)

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

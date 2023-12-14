from collections.abc import AsyncGenerator
from datetime import date
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import UUID4, EmailStr

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Anonymous, Authz
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.csv import get_emails_from_csv
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Repository, Subscription, SubscriptionBenefit, SubscriptionTier
from polar.models.organization import Organization
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.models.subscription_tier import SubscriptionTierType
from polar.organization.dependencies import (
    OptionalOrganizationNamePlatform,
    OrganizationNamePlatform,
)
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags

from .schemas import (
    FreeSubscriptionCreate,
    SubscribeSession,
    SubscribeSessionCreate,
    SubscriptionBenefitCreate,
    SubscriptionBenefitUpdate,
    SubscriptionsImported,
    SubscriptionsStatistics,
    SubscriptionSummary,
    SubscriptionTierBenefitsUpdate,
    SubscriptionTierCreate,
    SubscriptionTierUpdate,
    SubscriptionUpgrade,
    subscription_benefit_schema_map,
)
from .schemas import (
    Subscription as SubscriptionSchema,
)
from .schemas import SubscriptionBenefit as SubscriptionBenefitSchema
from .schemas import SubscriptionTier as SubscriptionTierSchema
from .service.subscribe_session import subscribe_session as subscribe_session_service
from .service.subscription import SearchSortProperty
from .service.subscription import subscription as subscription_service
from .service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from .service.subscription_tier import subscription_tier as subscription_tier_service

log = structlog.get_logger()


async def is_feature_flag_enabled(auth: Auth = Depends(Auth.optional_user)) -> None:
    if not posthog.client:
        # allowed
        return None

    if auth.subject is None or auth.user is None:
        raise HTTPException(403, "You don't have access to this feature.")

    if not posthog.client.feature_enabled(
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
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    include_archived: bool = Query(False),
    type: SubscriptionTierType | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[SubscriptionTierSchema]:
    organization_name, platform = organization_name_platform
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
        include_archived=include_archived,
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
    "/tiers/{id}/benefits", response_model=SubscriptionTierSchema, tags=[Tags.PUBLIC]
)
async def update_subscription_tier_benefits(
    id: UUID4,
    benefits_update: SubscriptionTierBenefitsUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionTier:
    subscription_tier = await subscription_tier_service.get_by_id(
        session, auth.subject, id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    subscription_tier, _, _ = await subscription_tier_service.update_benefits(
        session, authz, subscription_tier, benefits_update.benefits, auth.user
    )
    return subscription_tier


@router.get(
    "/benefits/search",
    response_model=ListResource[SubscriptionBenefitSchema],
    tags=[Tags.PUBLIC],
)
async def search_subscription_benefits(
    auth: UserRequiredAuth,
    pagination: PaginationParamsQuery,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    type: SubscriptionBenefitType | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionBenefitSchema]:
    organization_name, platform = organization_name_platform
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

    results, count = await subscription_benefit_service.search(
        session,
        auth.subject,
        type=type,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [
            subscription_benefit_schema_map[result.type].from_orm(result)
            for result in results
        ],
        count,
        pagination,
    )


@router.get(
    "/benefits/lookup",
    response_model=SubscriptionBenefitSchema,
    tags=[Tags.PUBLIC],
)
async def lookup_subscription_benefit(
    subscription_benefit_id: UUID4,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionBenefit:
    subscription_benefit = await subscription_benefit_service.get_by_id(
        session, auth.subject, subscription_benefit_id
    )

    if subscription_benefit is None:
        raise ResourceNotFound()

    return subscription_benefit


@router.post(
    "/benefits/",
    response_model=SubscriptionBenefitSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_subscription_benefit(
    subscription_benefit_create: SubscriptionBenefitCreate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionBenefit:
    return await subscription_benefit_service.user_create(
        session, authz, subscription_benefit_create, auth.user
    )


@router.post(
    "/benefits/{id}", response_model=SubscriptionBenefitSchema, tags=[Tags.PUBLIC]
)
async def update_subscription_benefit(
    id: UUID4,
    subscription_benefit_update: SubscriptionBenefitUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionBenefit:
    subscription_benefit = await subscription_benefit_service.get_by_id(
        session, auth.subject, id
    )

    if subscription_benefit is None:
        raise ResourceNotFound()

    return await subscription_benefit_service.user_update(
        session, authz, subscription_benefit, subscription_benefit_update, auth.user
    )


@router.delete("/benefits/{id}", status_code=204, tags=[Tags.PUBLIC])
async def delete_subscription_benefit(
    id: UUID4,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    subscription_benefit = await subscription_benefit_service.get_by_id(
        session, auth.subject, id
    )

    if subscription_benefit is None:
        raise ResourceNotFound()

    await subscription_benefit_service.user_delete(
        session, authz, subscription_benefit, auth.user
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
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscribeSession:
    subscription_tier = await subscription_tier_service.get_by_id(
        session, auth.subject, session_create.tier_id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return await subscribe_session_service.create_subscribe_session(
        session,
        subscription_tier,
        session_create.success_url,
        auth.subject,
        auth.auth_method,
        authz,
        customer_email=session_create.customer_email,
        organization_id=session_create.organization_subscriber_id,
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
    return await subscribe_session_service.get_subscribe_session(session, id)


@router.get(
    "/subscriptions/statistics",
    response_model=SubscriptionsStatistics,
    tags=[Tags.PUBLIC],
)
async def get_subscriptions_statistics(
    auth: UserRequiredAuth,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    start_date: date = Query(...),
    end_date: date = Query(...),
    direct_organization: bool = Query(True),
    types: list[SubscriptionTierType] | None = Query(None),
    subscription_tier_id: UUID4 | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionsStatistics:
    organization_name, platform = organization_name_platform
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

    periods = await subscription_service.get_statistics_periods(
        session,
        auth.user,
        start_date=start_date,
        end_date=end_date,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        types=types,
        subscription_tier_id=subscription_tier_id,
    )
    return SubscriptionsStatistics(periods=periods)


SearchSorting = Annotated[
    list[Sorting[SearchSortProperty]],
    Depends(SortingGetter(SearchSortProperty, ["-started_at"])),
]


@router.get(
    "/subscriptions/search",
    response_model=ListResource[SubscriptionSchema],
    tags=[Tags.PUBLIC],
)
async def search_subscriptions(
    auth: UserRequiredAuth,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization_name_platform: OptionalOrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    type: SubscriptionTierType | None = Query(None),
    subscription_tier_id: UUID4 | None = Query(None),
    subscriber_user_id: UUID4 | None = Query(None),
    subscriber_organization_id: UUID4 | None = Query(None),
    active: bool | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSchema]:
    organization: Organization | None = None
    if organization_name_platform is not None:
        organization_name, platform = organization_name_platform
        organization = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if organization is None:
            raise ResourceNotFound("Organization not found")

    repository: Repository | None = None
    if repository_name is not None:
        if organization is None:
            raise BadRequest(
                "organization_name and platform are required when repository_name is set"
            )
        repository = await repository_service.get_by_org_and_name(
            session, organization.id, repository_name
        )
        if repository is None:
            raise ResourceNotFound("Repository not found")

    results, count = await subscription_service.search(
        session,
        auth.user,
        type=type,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        subscription_tier_id=subscription_tier_id,
        subscriber_user_id=subscriber_user_id,
        subscriber_organization_id=subscriber_organization_id,
        active=active,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSchema.from_orm(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/subscriptions/",
    response_model=SubscriptionSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_free_subscription(
    free_subscription_create: FreeSubscriptionCreate,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    return await subscription_service.create_free_subscription(
        session,
        free_subscription_create=free_subscription_create,
        auth_subject=auth.subject,
        auth_method=auth.auth_method,
    )


@router.post(
    "/subscriptions/import",
    response_model=SubscriptionsImported,
    tags=[Tags.PUBLIC],
)
async def subscriptions_import(
    auth: UserRequiredAuth,
    file: UploadFile,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionsImported:
    organization: Organization | None = None
    if organization_name_platform is not None:
        organization_name, platform = organization_name_platform
        organization = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if organization is None:
            raise ResourceNotFound("Organization not found")

    repository: Repository | None = None
    if repository_name is not None:
        if organization is None:
            raise BadRequest(
                "organization_name and platform are required when repository_name is set"
            )
        repository = await repository_service.get_by_org_and_name(
            session, organization.id, repository_name
        )
        if repository is None:
            raise ResourceNotFound("Repository not found")

    # find free tier
    (tiers, _) = await subscription_tier_service.search(
        session,
        auth.subject,
        type=SubscriptionTierType.free,
        organization=organization,
        repository=repository,
        pagination=PaginationParamsQuery(page=1, limit=1),
    )

    if not tiers or len(tiers) != 1:
        raise ResourceNotFound("No free tier found")

    # authz
    if not await authz.can(auth.subject, AccessType.write, organization):
        raise Unauthorized()

    contents = await file.read()
    emails = get_emails_from_csv(contents.decode("utf-8"))

    count = 0

    for email in emails:
        try:
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=tiers[0].id,
                    customer_email=EmailStr(email),
                ),
                auth_subject=Anonymous(),  # do not forward auth!
                auth_method=None,
            )
            count += 1
        except Exception as e:
            log.error("subscriptions_import.failed", e=e)

    return SubscriptionsImported(count=count)


@router.get(
    "/subscriptions/export",
    tags=[Tags.PUBLIC],
)
async def subscriptions_export(
    auth: UserRequiredAuth,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    organization: Organization | None = None
    if organization_name_platform is not None:
        organization_name, platform = organization_name_platform
        organization = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if organization is None:
            raise ResourceNotFound("Organization not found")

    repository: Repository | None = None
    if repository_name is not None:
        if organization is None:
            raise BadRequest(
                "organization_name and platform are required when repository_name is set"
            )
        repository = await repository_service.get_by_org_and_name(
            session, organization.id, repository_name
        )
        if repository is None:
            raise ResourceNotFound("Repository not found")

    # authz
    if not await authz.can(auth.subject, AccessType.write, organization):
        raise Unauthorized()

    async def create_csv() -> AsyncGenerator[str, None]:
        # CSV header
        yield "email,name,created_at,active,tier\n"

        (subscribers, _) = await subscription_service.search(
            session,
            user=auth.subject,
            organization=organization,
            repository=repository,
            pagination=PaginationParams(limit=1000000, page=1),
        )

        for sub in subscribers:
            fields = [
                sub.user.email,
                sub.user.username,
                sub.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "true" if sub.active else "false",
                sub.subscription_tier.name,
            ]

            # strip commas (poor mans CSV)
            fields = [f.replace(",", "") for f in fields]

            yield ",".join(fields) + "\n"

    name = f"{organization.name}_subscribers.csv"
    headers = {"Content-Disposition": f'inline; filename="{name}"'}
    return StreamingResponse(create_csv(), headers=headers, media_type="text/csv")


@router.post(
    "/subscriptions/{id}", response_model=SubscriptionSchema, tags=[Tags.PUBLIC]
)
async def upgrade_subscription(
    id: UUID4,
    subscription_upgrade: SubscriptionUpgrade,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    subscription = await subscription_service.get(session, id)
    if subscription is None:
        raise ResourceNotFound()

    return await subscription_service.upgrade_subscription(
        session,
        subscription=subscription,
        subscription_upgrade=subscription_upgrade,
        authz=authz,
        user=auth.subject,
    )


@router.delete(
    "/subscriptions/{id}", response_model=SubscriptionSchema, tags=[Tags.PUBLIC]
)
async def cancel_subscription(
    id: UUID4,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    subscription = await subscription_service.get(session, id)
    if subscription is None:
        raise ResourceNotFound()

    return await subscription_service.cancel_subscription(
        session, subscription=subscription, authz=authz, user=auth.subject
    )


@router.get(
    "/subscriptions/summary",
    response_model=ListResource[SubscriptionSummary],
    tags=[Tags.PUBLIC],
)
async def search_subscriptions_summary(
    pagination: PaginationParamsQuery,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSummary]:
    organization_name, platform = organization_name_platform
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

    results, count = await subscription_service.search_summary(
        session,
        organization=organization,
        repository=repository,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSummary.from_orm(result) for result in results],
        count,
        pagination,
    )

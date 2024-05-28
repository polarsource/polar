from collections.abc import AsyncGenerator
from datetime import date
from typing import Annotated

import structlog
from fastapi import Depends, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.authz.service import AccessType, Authz
from polar.enums import UserSignupType
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.csv import get_emails_from_csv, get_iterable_from_binary_io
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Subscription
from polar.models.product import SubscriptionTierType
from polar.organization.dependencies import (
    ResolvedOptionalOrganization,
    ResolvedOrganization,
)
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.tags.api import Tags
from polar.user.service.user import user as user_service

from ..product.service.product import (
    product as product_service,
)
from . import auth
from .schemas import (
    FreeSubscriptionCreate,
    SubscriptionCreateEmail,
    SubscriptionsImported,
    SubscriptionsStatistics,
    SubscriptionSubscriber,
    SubscriptionSummary,
    SubscriptionUpgrade,
)
from .schemas import Subscription as SubscriptionSchema
from .service import AlreadySubscribed, SearchSortProperty
from .service import subscription as subscription_service

log = structlog.get_logger()

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get(
    "/subscriptions/statistics",
    response_model=SubscriptionsStatistics,
    tags=[Tags.PUBLIC],
)
async def get_subscriptions_statistics(
    auth_subject: auth.CreatorSubscriptionsRead,
    organization: ResolvedOrganization,
    start_date: date = Query(...),
    end_date: date = Query(...),
    types: list[SubscriptionTierType] | None = Query(None),
    subscription_tier_id: UUID4 | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionsStatistics:
    periods = await subscription_service.get_statistics_periods(
        session,
        auth_subject,
        start_date=start_date,
        end_date=end_date,
        organization=organization,
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
    auth_subject: auth.CreatorSubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization: ResolvedOrganization,
    type: SubscriptionTierType | None = Query(None),
    subscription_tier_id: UUID4 | None = Query(None),
    subscriber_user_id: UUID4 | None = Query(None),
    subscriber_organization_id: UUID4 | None = Query(None),
    active: bool | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSchema]:
    results, count = await subscription_service.search(
        session,
        auth_subject,
        type=type,
        organization=organization,
        subscription_tier_id=subscription_tier_id,
        subscriber_user_id=subscriber_user_id,
        subscriber_organization_id=subscriber_organization_id,
        active=active,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/subscriptions/subscribed",
    response_model=ListResource[SubscriptionSubscriber],
    tags=[Tags.PUBLIC],
)
async def search_subscribed_subscriptions(
    auth_subject: auth.BackerSubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization: ResolvedOptionalOrganization,
    type: SubscriptionTierType | None = Query(None),
    subscription_tier_id: UUID4 | None = Query(None),
    subscriber_user_id: UUID4 | None = Query(None),
    subscriber_organization_id: UUID4 | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSubscriber]:
    results, count = await subscription_service.search_subscribed(
        session,
        auth_subject,
        type=type,
        organization=organization,
        subscription_tier_id=subscription_tier_id,
        subscriber_user_id=subscriber_user_id,
        subscriber_organization_id=subscriber_organization_id,
        active=True,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSubscriber.model_validate(result) for result in results],
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
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    subscription = await subscription_service.create_free_subscription(
        session,
        free_subscription_create=free_subscription_create,
        auth_subject=auth_subject,
    )

    if is_user(auth_subject):
        posthog.auth_subject_event(
            auth_subject,
            "subscriptions",
            "free_subscription",
            "create",
            {
                "subscription_id": subscription.id,
                "subscription_tier_id": free_subscription_create.tier_id,
            },
        )

    return subscription


@router.post(
    "/subscriptions/email",
    response_model=SubscriptionSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_email_subscription(
    subscription_create: SubscriptionCreateEmail,
    auth_subject: auth.CreatorSubscriptionsWrite,
    organization: ResolvedOrganization,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    # authz
    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise Unauthorized()

    # find free tier
    free_tier = await product_service.get_free(session, organization=organization)
    if free_tier is None:
        raise ResourceNotFound("No free tier found")

    user = await user_service.get_by_email_or_signup(
        session, subscription_create.email, signup_type=UserSignupType.imported
    )
    subscription = await subscription_service.create_arbitrary_subscription(
        session, user=user, product=free_tier
    )

    posthog.auth_subject_event(
        auth_subject,
        "subscriptions",
        "email_import",
        "create",
        {"subscription_tier_id": free_tier.id},
    )

    return subscription


@router.post(
    "/subscriptions/import",
    response_model=SubscriptionsImported,
    tags=[Tags.PUBLIC],
)
async def subscriptions_import(
    auth_subject: auth.CreatorSubscriptionsWrite,
    file: UploadFile,
    organization: ResolvedOrganization,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionsImported:
    # find free tier
    free_tier = await product_service.get_free(session, organization=organization)
    if free_tier is None:
        raise ResourceNotFound("No free tier found")

    # authz
    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise Unauthorized()

    emails = get_emails_from_csv(get_iterable_from_binary_io(file.file))

    count = 0

    for email in emails:
        try:
            user = await user_service.get_by_email_or_signup(
                session, email, signup_type=UserSignupType.imported
            )
            await subscription_service.create_arbitrary_subscription(
                session, user=user, product=free_tier
            )
            count += 1
        except AlreadySubscribed:
            pass
        except Exception as e:
            log.error("subscriptions_import.failed", e=e)

    posthog.auth_subject_event(
        auth_subject,
        "subscriptions",
        "import",
        "create",
        {
            "subscription_tier_id": free_tier.id,
            "email_count": count,
        },
    )

    return SubscriptionsImported(count=count)


@router.get(
    "/subscriptions/export",
    tags=[Tags.PUBLIC],
)
async def subscriptions_export(
    auth_subject: auth.CreatorSubscriptionsRead,
    organization: ResolvedOrganization,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    # authz
    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise Unauthorized()

    async def create_csv() -> AsyncGenerator[str, None]:
        # CSV header
        yield "email,name,created_at,active,tier\n"

        (subscribers, _) = await subscription_service.search(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(limit=1000000, page=1),
        )

        for sub in subscribers:
            fields = [
                sub.user.email,
                sub.user.username_or_email,
                sub.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "true" if sub.active else "false",
                sub.product.name,
            ]

            # strip commas (poor mans CSV)
            fields = [f.replace(",", "") for f in fields]

            yield ",".join(fields) + "\n"

    posthog.auth_subject_event(auth_subject, "subscriptions", "export", "create")

    name = f"{organization.name}_subscribers.csv"
    headers = {"Content-Disposition": f'attachment; filename="{name}"'}
    return StreamingResponse(create_csv(), headers=headers, media_type="text/csv")


@router.post(
    "/subscriptions/{id}", response_model=SubscriptionSchema, tags=[Tags.PUBLIC]
)
async def upgrade_subscription(
    id: UUID4,
    subscription_upgrade: SubscriptionUpgrade,
    auth_subject: auth.BackerSubscriptionsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    subscription = await subscription_service.get(session, id)
    if subscription is None:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject, "subscriptions", "upgrade_subscription", "submit"
    )

    return await subscription_service.upgrade_subscription(
        session,
        subscription=subscription,
        subscription_upgrade=subscription_upgrade,
        authz=authz,
        auth_subject=auth_subject,
    )


@router.delete(
    "/subscriptions/{id}", response_model=SubscriptionSchema, tags=[Tags.PUBLIC]
)
async def cancel_subscription(
    id: UUID4,
    auth_subject: auth.BackerSubscriptionsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    subscription = await subscription_service.get(session, id)
    if subscription is None:
        raise ResourceNotFound()

    posthog.auth_subject_event(auth_subject, "subscriptions", "subscription", "cancel")

    return await subscription_service.cancel_subscription(
        session, subscription=subscription, authz=authz, auth_subject=auth_subject
    )


@router.get(
    "/subscriptions/summary",
    response_model=ListResource[SubscriptionSummary],
    tags=[Tags.PUBLIC],
)
async def search_subscriptions_summary(
    pagination: PaginationParamsQuery,
    organization: ResolvedOrganization,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSummary]:
    results, count = await subscription_service.search_summary(
        session, organization=organization, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [SubscriptionSummary.model_validate(result) for result in results],
        count,
        pagination,
    )

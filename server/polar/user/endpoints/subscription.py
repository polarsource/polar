from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Subscription
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from .. import auth
from ..schemas.subscription import (
    UserSubscription,
    UserSubscriptionUpdate,
)
from ..service.subscription import (
    AlreadyCanceledSubscription,
    UserSubscriptionSortProperty,
)
from ..service.subscription import user_subscription as user_subscription_service

router = APIRouter(
    prefix="/subscriptions", tags=["subscriptions", APITag.documented, APITag.featured]
)

SubscriptionID = Annotated[UUID4, Path(description="The subscription ID.")]
SubscriptionNotFound = {
    "description": "Subscription not found.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[UserSubscriptionSortProperty]],
    Depends(SortingGetter(UserSubscriptionSortProperty, ["-started_at"])),
]


@router.get(
    "/", summary="List Subscriptions", response_model=ListResource[UserSubscription]
)
async def list(
    auth_subject: auth.UserSubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    active: bool | None = Query(
        None,
        description=("Filter by active or cancelled subscription."),
    ),
    query: str | None = Query(
        None, description="Search by product or organization name."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[UserSubscription]:
    """List my subscriptions."""
    results, count = await user_subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        active=active,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [UserSubscription.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Subscription",
    response_model=UserSubscription,
    responses={404: SubscriptionNotFound},
)
async def get(
    id: SubscriptionID,
    auth_subject: auth.UserSubscriptionsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Get a subscription by ID."""
    subscription = await user_subscription_service.get_by_id(session, auth_subject, id)

    if subscription is None:
        raise ResourceNotFound()

    return subscription


@router.patch(
    "/{id}",
    summary="Update Subscription",
    response_model=UserSubscription,
    responses={
        200: {"description": "Subscription updated."},
        404: SubscriptionNotFound,
    },
)
async def update(
    id: SubscriptionID,
    subscription_update: UserSubscriptionUpdate,
    auth_subject: auth.UserSubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Update a subscription."""
    subscription = await user_subscription_service.get_by_id(session, auth_subject, id)

    if subscription is None:
        raise ResourceNotFound()

    return await user_subscription_service.update(
        session, subscription=subscription, subscription_update=subscription_update
    )


@router.delete(
    "/{id}",
    summary="Cancel Subscription",
    response_model=UserSubscription,
    responses={
        200: {"description": "Subscription canceled."},
        403: {
            "description": (
                "This subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def cancel(
    id: SubscriptionID,
    auth_subject: auth.UserSubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Cancel a subscription."""
    subscription = await user_subscription_service.get_by_id(session, auth_subject, id)

    if subscription is None:
        raise ResourceNotFound()

    return await user_subscription_service.cancel(session, subscription=subscription)

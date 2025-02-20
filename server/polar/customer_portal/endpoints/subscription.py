from typing import Annotated

import structlog
from fastapi import Depends, Query

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
from polar.subscription.schemas import SubscriptionID
from polar.subscription.service import AlreadyCanceledSubscription

from .. import auth
from ..schemas.subscription import CustomerSubscription, CustomerSubscriptionUpdate
from ..service.subscription import CustomerSubscriptionSortProperty
from ..service.subscription import (
    customer_subscription as customer_subscription_service,
)

log = structlog.get_logger()

router = APIRouter(
    prefix="/subscriptions", tags=["subscriptions", APITag.documented, APITag.featured]
)

SubscriptionNotFound = {
    "description": "Customer subscription was not found.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[CustomerSubscriptionSortProperty]],
    Depends(SortingGetter(CustomerSubscriptionSortProperty, ["-started_at"])),
]


@router.get(
    "/", summary="List Subscriptions", response_model=ListResource[CustomerSubscription]
)
async def list(
    auth_subject: auth.CustomerPortalRead,
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
) -> ListResource[CustomerSubscription]:
    """List subscriptions of the authenticated customer."""
    results, count = await customer_subscription_service.list(
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
        [CustomerSubscription.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Subscription",
    response_model=CustomerSubscription,
    responses={404: SubscriptionNotFound},
)
async def get(
    id: SubscriptionID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Get a subscription for the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    return subscription


@router.patch(
    "/{id}",
    summary="Update Subscription",
    response_model=CustomerSubscription,
    responses={
        200: {"description": "Customer subscription updated."},
        403: {
            "description": (
                "Customer subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def update(
    id: SubscriptionID,
    subscription_update: CustomerSubscriptionUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Update a subscription of the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "customer_portal.subscription.cancel",
        id=id,
        customer_id=auth_subject.subject.id,
        updates=subscription_update,
    )
    return await customer_subscription_service.update(
        session, subscription, updates=subscription_update
    )


@router.delete(
    "/{id}",
    summary="Cancel Subscription",
    response_model=CustomerSubscription,
    responses={
        200: {"description": "Customer subscription is canceled."},
        403: {
            "description": (
                "Customer subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def cancel(
    id: SubscriptionID,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Cancel a subscription of the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "customer_portal.subscription.cancel",
        id=id,
        customer_id=auth_subject.subject.id,
    )
    return await customer_subscription_service.cancel(session, subscription)

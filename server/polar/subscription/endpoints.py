from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import Depends, Path, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.csv import (
    IterableCSVWriter,
)
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Subscription
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth
from .schemas import Subscription as SubscriptionSchema
from .schemas import SubscriptionUpdate
from .service import AlreadyCanceledSubscription, SubscriptionSortProperty
from .service import subscription as subscription_service

log = structlog.get_logger()

router = APIRouter(prefix="/subscriptions", tags=["subscriptions", APITag.documented])

SubscriptionID = Annotated[UUID4, Path(description="The subscription ID.")]
SubscriptionNotFound = {
    "description": "Subscription not found.",
    "model": ResourceNotFound.schema(),
}


SearchSorting = Annotated[
    list[Sorting[SubscriptionSortProperty]],
    Depends(SortingGetter(SubscriptionSortProperty, ["-started_at"])),
]


@router.get(
    "/", response_model=ListResource[SubscriptionSchema], summary="List Subscriptions"
)
async def list(
    auth_subject: auth.SubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    customer_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    discount_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="DiscountID Filter", description="Filter by discount ID."
    ),
    active: bool | None = Query(
        None, description="Filter by active or inactive subscription."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSchema]:
    """List subscriptions."""
    results, count = await subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        customer_id=customer_id,
        discount_id=discount_id,
        active=active,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/export", summary="Export Subscriptions")
async def export(
    auth_subject: auth.SubscriptionsRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export subscriptions as a CSV file."""

    async def create_csv() -> AsyncGenerator[str, None]:
        csv_writer = IterableCSVWriter(dialect="excel")
        # CSV header
        yield csv_writer.getrow(
            (
                "Email",
                "Created At",
                "Active",
                "Product",
                "Price",
                "Currency",
                "Interval",
            )
        )

        (subscribers, _) = await subscription_service.list(
            session,
            auth_subject,
            organization_id=organization_id,
            pagination=PaginationParams(limit=1000000, page=1),
        )

        for sub in subscribers:
            yield csv_writer.getrow(
                (
                    sub.customer.email,
                    sub.created_at.isoformat(),
                    "true" if sub.active else "false",
                    sub.product.name,
                    sub.amount / 100 if sub.amount is not None else "",
                    sub.currency if sub.currency is not None else "",
                    sub.recurring_interval,
                )
            )

    filename = "polar-subscribers.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.patch(
    "/{id}",
    summary="Update Subscription",
    response_model=SubscriptionSchema,
    responses={
        200: {"description": "Subscription updated."},
        403: {
            "description": (
                "Subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def update(
    id: SubscriptionID,
    subscription_update: SubscriptionUpdate,
    auth_subject: auth.SubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Update a subscription."""
    subscription = await subscription_service.user_get(session, auth_subject, id)
    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "subscription.update",
        id=id,
        customer_id=auth_subject.subject.id,
        updates=subscription_update,
    )
    return await subscription_service.update(
        session, subscription, updates=subscription_update
    )


@router.delete(
    "/{id}",
    summary="Revoke Subscription",
    response_model=SubscriptionSchema,
    responses={
        200: {"description": "Subscription revoked."},
        403: {
            "description": "This subscription is already revoked.",
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def revoke(
    id: SubscriptionID,
    auth_subject: auth.SubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Revoke a subscription, i.e cancel immediately."""
    subscription = await subscription_service.user_get(session, auth_subject, id)
    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "subscription.revoke", id=id, admin_id=auth_subject.subject.id, immediate=True
    )
    return await subscription_service.revoke(
        session,
        subscription=subscription,
    )

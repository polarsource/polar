from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends, Query, Response
from fastapi.responses import StreamingResponse

from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.csv import IterableCSVWriter
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.locker import Locker, get_locker
from polar.models import Subscription
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Subscription as SubscriptionSchema
from .schemas import (
    SubscriptionChargePreview,
    SubscriptionCreate,
    SubscriptionID,
    SubscriptionUpdate,
)
from .service import (
    AlreadyCanceledSubscription,
    SubscriptionLocked,
)
from .service import subscription as subscription_service

log = structlog.get_logger()

router = APIRouter(
    prefix="/subscriptions", tags=["subscriptions", APITag.public, APITag.mcp]
)

SubscriptionNotFound = {
    "description": "Subscription not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    response_model=ListResource[SubscriptionSchema],
    summary="List Subscriptions",
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.SubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    external_customer_id: MultipleQueryFilter[ExternalCustomerID] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by customer external ID.",
    ),
    discount_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="DiscountID Filter", description="Filter by discount ID."
    ),
    active: bool | None = Query(
        None, description="Filter by active or inactive subscription."
    ),
    cancel_at_period_end: bool | None = Query(
        None,
        description="Filter by subscriptions that are set to cancel at period end.",
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[SubscriptionSchema]:
    """List subscriptions."""
    results, count = await subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        discount_id=discount_id,
        active=active,
        cancel_at_period_end=cancel_at_period_end,
        metadata=metadata,
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
    session: AsyncReadSession = Depends(get_db_read_session),
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
                    sub.amount / 100,
                    sub.currency,
                    sub.recurring_interval,
                )
            )

    filename = "polar-subscribers.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/{id}",
    summary="Get Subscription",
    response_model=SubscriptionSchema,
    responses={404: SubscriptionNotFound},
)
async def get(
    id: SubscriptionID,
    auth_subject: auth.SubscriptionsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Subscription:
    """Get a subscription by ID."""
    subscription = await subscription_service.get(session, auth_subject, id)

    if subscription is None:
        raise ResourceNotFound()

    return subscription


@router.get(
    "/{id}/charge-preview",
    summary="Preview Next Charge For Subscription",
    response_model=SubscriptionChargePreview,
    responses={404: SubscriptionNotFound},
    tags=[APITag.private],
)
async def get_charge_preview(
    id: SubscriptionID,
    auth_subject: auth.SubscriptionsRead,
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionChargePreview:
    """
    Get a preview of the next charge for an active or trialing subscription.

    Returns a breakdown of:
    - Base subscription amount
    - Metered usage charges
    - Applied discounts
    - Calculated taxes
    - Total amount

    For trialing subscriptions, shows what the first charge will be when the trial ends.
    For subscriptions set to cancel at period end, shows the final charge.
    Only available for active or trialing subscriptions, including those set to cancel.
    """
    subscription = await subscription_service.get(session, auth_subject, id)

    if subscription is None:
        raise ResourceNotFound()

    # Allow active, trialing, and subscriptions set to cancel at period end
    if subscription.status not in ("active", "trialing"):
        raise ResourceNotFound()

    # If subscription will end (cancel_at_period_end or ends_at), ensure there's still a charge coming
    if subscription.cancel_at_period_end or subscription.ends_at:
        # Only show preview if we haven't reached the end date yet
        if subscription.ended_at:
            raise ResourceNotFound()

    return await subscription_service.calculate_charge_preview(session, subscription)


@router.post(
    "/",
    response_model=SubscriptionSchema,
    status_code=201,
    summary="Create Subscription",
    responses={201: {"description": "Subscription created."}},
)
async def create(
    subscription_create: SubscriptionCreate,
    auth_subject: auth.SubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """
    Create a subscription programmatically.

    This endpoint only allows to create subscription on free products.
    For paid products, use the checkout flow.

    No initial order will be created and no confirmation email will be sent.
    """
    return await subscription_service.create(session, subscription_create, auth_subject)


@router.patch(
    "/{id}",
    summary="Update Subscription",
    response_model=SubscriptionSchema,
    responses={
        200: {"description": "Subscription updated."},
        403: {
            "description": (
                "Subscription is already canceled or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
        409: {
            "description": "Subscription is pending an update.",
            "model": SubscriptionLocked.schema(),
        },
    },
)
async def update(
    id: SubscriptionID,
    subscription_update: SubscriptionUpdate,
    auth_subject: auth.SubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Subscription:
    """Update a subscription."""
    subscription = await subscription_service.get(session, auth_subject, id)
    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "subscription.update",
        id=id,
        customer_id=auth_subject.subject.id,
        updates=subscription_update,
    )
    async with subscription_service.lock(locker, subscription):
        return await subscription_service.update(
            session, locker, subscription, update=subscription_update
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
        409: {
            "description": "Subscription is pending an update.",
            "model": SubscriptionLocked.schema(),
        },
    },
)
async def revoke(
    id: SubscriptionID,
    auth_subject: auth.SubscriptionsWrite,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Subscription:
    """Revoke a subscription, i.e cancel immediately."""
    subscription = await subscription_service.get(session, auth_subject, id)
    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "subscription.revoke", id=id, admin_id=auth_subject.subject.id, immediate=True
    )
    async with subscription_service.lock(locker, subscription):
        return await subscription_service.revoke(session, subscription)

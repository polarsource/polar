from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends, Query, Response
from fastapi.responses import StreamingResponse

from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.customer_seat import seat_service
from polar.customer_seat.auth import SeatRead, SeatWrite
from polar.customer_seat.repository import CustomerSeatRepository
from polar.customer_seat.schemas import CustomerSeat as CustomerSeatSchema
from polar.customer_seat.schemas import CustomerSeatID, SeatAssign, SeatsList
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
from .schemas import SubscriptionID, SubscriptionUpdate
from .service import AlreadyCanceledSubscription, SubscriptionLocked
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


#
# Seat Management Endpoints
#


@router.get(
    "/{id}/seats",
    summary="List Subscription Seats",
    response_model=SeatsList,
    tags=["subscriptions", APITag.private],
    responses={
        404: SubscriptionNotFound,
        403: {"description": "Seat-based pricing not enabled for organization"},
    },
)
async def list_seats(
    id: SubscriptionID,
    auth_subject: SeatRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SeatsList:
    subscription = await subscription_service.get(session, auth_subject, id)
    if not subscription:
        raise ResourceNotFound()

    seats = await seat_service.list_seats(session, subscription)
    available_seats = await seat_service.get_available_seats_count(
        session, subscription
    )
    total_seats = subscription.seats or 0

    return SeatsList(
        seats=[CustomerSeatSchema.model_validate(seat) for seat in seats],
        available_seats=available_seats,
        total_seats=total_seats,
    )


@router.post(
    "/{id}/seats",
    summary="Assign Seat",
    response_model=CustomerSeatSchema,
    tags=["subscriptions", APITag.private],
    responses={
        400: {"description": "No seats available or customer already has seat"},
        403: {"description": "Seat-based pricing not enabled for organization"},
        404: SubscriptionNotFound,
    },
)
async def assign_seat(
    id: SubscriptionID,
    seat_assign: SeatAssign,
    auth_subject: SeatWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    subscription = await subscription_service.get(session, auth_subject, id)
    if not subscription:
        raise ResourceNotFound()

    seat = await seat_service.assign_seat(
        session,
        subscription=subscription,
        email=seat_assign.email,
        external_customer_id=seat_assign.external_customer_id,
        metadata=seat_assign.metadata,
    )

    return CustomerSeatSchema.model_validate(seat)


@router.delete(
    "/{id}/seats/{seat_id}",
    summary="Revoke Seat",
    response_model=CustomerSeatSchema,
    tags=["subscriptions", APITag.private],
    responses={
        403: {"description": "Seat-based pricing not enabled for organization"},
        404: SubscriptionNotFound,
    },
)
async def revoke_seat(
    id: SubscriptionID,
    seat_id: CustomerSeatID,
    auth_subject: SeatWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    subscription = await subscription_service.get(session, auth_subject, id)
    if not subscription:
        raise ResourceNotFound()

    seat_repository = CustomerSeatRepository.from_session(session)

    seat = await seat_repository.get_by_subscription_and_auth_subject(
        auth_subject,
        seat_id,
        subscription.id,
        options=seat_repository.get_eager_options(),
    )

    if not seat:
        raise ResourceNotFound()

    seat_service.check_seat_feature_enabled(seat.subscription.product.organization)

    revoked_seat = await seat_service.revoke_seat(session, seat)
    return CustomerSeatSchema.model_validate(revoked_seat)

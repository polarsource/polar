from typing import Annotated

import structlog
from fastapi import Depends, Query
from pydantic import UUID4
from sqlalchemy.orm import joinedload, selectinload

from polar.customer_seat.schemas import CustomerSeat as CustomerSeatSchema
from polar.customer_seat.schemas import SeatsList
from polar.customer_seat.service import seat_service
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import CustomerSeat, Order, Product, Subscription
from polar.openapi import APITag
from polar.order.repository import OrderRepository
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.subscription.repository import SubscriptionRepository

from .. import auth
from ..schemas.seat import CustomerSeatAssign
from ..schemas.subscription import CustomerSubscription
from ..service.customer_seat import customer_seat as customer_seat_service
from ..utils import get_customer

log = structlog.get_logger()

router = APIRouter(prefix="/seats", tags=["seats", APITag.public])


@router.get(
    "",
    summary="List Seats",
    response_model=SeatsList,
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription or order not found"},
    },
)
async def list_seats(
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
    subscription_id: Annotated[
        UUID4 | None, Query(description="Subscription ID")
    ] = None,
    order_id: Annotated[UUID4 | None, Query(description="Order ID")] = None,
) -> SeatsList:
    customer = get_customer(auth_subject)

    subscription: Subscription | None = None
    order: Order | None = None
    total_seats = 0

    if subscription_id:
        subscription_repository = SubscriptionRepository.from_session(session)

        statement = (
            subscription_repository.get_readable_statement(auth_subject)
            .options(*subscription_repository.get_eager_options())
            .where(
                Subscription.id == subscription_id,
            )
        )
        subscription = await subscription_repository.get_one_or_none(statement)

        if not subscription:
            raise ResourceNotFound("Subscription not found")

        total_seats = subscription.seats or 0

    elif order_id:
        order_repository = OrderRepository.from_session(session)

        order_statement = (
            order_repository.get_readable_statement(auth_subject)
            .options(*order_repository.get_eager_options())
            .where(
                Order.id == order_id,
            )
        )
        order = await order_repository.get_one_or_none(order_statement)

        if not order:
            raise ResourceNotFound("Order not found")

        total_seats = order.seats or 0

    else:
        raise BadRequest("Either subscription_id or order_id must be provided")

    container = subscription or order
    assert container is not None  # Already validated above

    seats = await seat_service.list_seats(session, container)
    available_seats = await seat_service.get_available_seats_count(session, container)

    return SeatsList(
        seats=[CustomerSeatSchema.model_validate(seat) for seat in seats],
        available_seats=available_seats,
        total_seats=total_seats,
    )


@router.post(
    "",
    summary="Assign Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "No available seats or customer already has a seat"},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription, order, or customer not found"},
    },
)
async def assign_seat(
    seat_assign: CustomerSeatAssign,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    container = await customer_seat_service.resolve_assign_container(
        session, auth_subject, seat_assign
    )

    return await seat_service.assign_seat(
        session,
        container,
        email=seat_assign.email,
        external_customer_id=seat_assign.external_customer_id,
        customer_id=seat_assign.customer_id,
        external_member_id=seat_assign.external_member_id,
        member_id=seat_assign.member_id,
        metadata=seat_assign.metadata,
        immediate_claim=seat_assign.immediate_claim,
    )


@router.delete(
    "/{seat_id}",
    summary="Revoke Seat",
    response_model=CustomerSeatSchema,
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Seat not found"},
    },
)
async def revoke_seat(
    seat_id: UUID4,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    customer = get_customer(auth_subject)

    seat = await seat_service.get_seat_for_customer(session, customer, seat_id)
    if not seat:
        raise ResourceNotFound("Seat not found")

    return await seat_service.revoke_seat(session, seat)


@router.post(
    "/{seat_id}/resend",
    summary="Resend Invitation",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "Seat is not pending or already claimed"},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Seat not found"},
    },
)
async def resend_invitation(
    seat_id: UUID4,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    customer = get_customer(auth_subject)

    seat = await seat_service.get_seat_for_customer(session, customer, seat_id)
    if not seat:
        raise ResourceNotFound("Seat not found")

    return await seat_service.resend_invitation(session, seat)


@router.get(
    "/subscriptions",
    summary="List Claimed Subscriptions",
    response_model=ListResource[CustomerSubscription],
    responses={
        401: {"description": "Authentication required"},
    },
)
async def list_claimed_subscriptions(
    auth_subject: auth.CustomerPortalUnionRead,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerSubscription]:
    """List all subscriptions where the authenticated customer has claimed a seat."""
    subscription_repository = SubscriptionRepository.from_session(session)

    statement = subscription_repository.get_claimed_subscriptions_statement(
        auth_subject
    ).options(
        joinedload(Subscription.customer),
        joinedload(Subscription.product).options(
            selectinload(Product.product_medias),
            joinedload(Product.organization),
        ),
        joinedload(Subscription.pending_update),
    )

    results, count = await subscription_repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    return ListResource.from_paginated_results(
        [CustomerSubscription.model_validate(result) for result in results],
        count,
        pagination,
    )

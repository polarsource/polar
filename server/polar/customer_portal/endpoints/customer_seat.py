from typing import Annotated

import structlog
from fastapi import Depends, Query
from pydantic import UUID4
from sqlalchemy.orm import joinedload, selectinload

from polar.customer_seat.repository import CustomerSeatRepository
from polar.customer_seat.schemas import CustomerSeat as CustomerSeatSchema
from polar.customer_seat.schemas import SeatAssign, SeatsList
from polar.customer_seat.service import seat_service
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.models import CustomerSeat, Order, Product, Subscription
from polar.openapi import APITag
from polar.order.repository import OrderRepository
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.subscription.repository import SubscriptionRepository

from .. import auth
from ..schemas.subscription import CustomerSubscription

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
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
    subscription_id: Annotated[
        UUID4 | None, Query(description="Subscription ID")
    ] = None,
    order_id: Annotated[UUID4 | None, Query(description="Order ID")] = None,
) -> SeatsList:
    customer = auth_subject.subject

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
    seat_assign: SeatAssign,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    customer = auth_subject.subject

    subscription: Subscription | None = None
    order: Order | None = None

    if seat_assign.subscription_id:
        subscription_repository = SubscriptionRepository.from_session(session)

        statement = (
            subscription_repository.get_base_statement()
            .options(*subscription_repository.get_eager_options())
            .where(
                Subscription.id == seat_assign.subscription_id,
                Subscription.customer_id == customer.id,
            )
        )
        subscription = await subscription_repository.get_one_or_none(statement)

        if not subscription:
            raise ResourceNotFound("Subscription not found")

    elif seat_assign.order_id:
        order_repository = OrderRepository.from_session(session)

        order_statement = (
            order_repository.get_base_statement()
            .options(*order_repository.get_eager_options())
            .where(
                Order.id == seat_assign.order_id,
                Order.customer_id == customer.id,
            )
        )
        order = await order_repository.get_one_or_none(order_statement)

        if not order:
            raise ResourceNotFound("Order not found")

    else:
        raise BadRequest("Either subscription_id or order_id is required")

    container = subscription or order
    assert container is not None  # Already validated above

    seat = await seat_service.assign_seat(
        session,
        container,
        email=seat_assign.email,
        external_customer_id=seat_assign.external_customer_id,
        customer_id=seat_assign.customer_id,
        metadata=seat_assign.metadata,
    )

    # Reload seat with customer relationship
    seat_repository = CustomerSeatRepository.from_session(session)
    seat_statement = (
        seat_repository.get_base_statement()
        .where(CustomerSeat.id == seat.id)
        .options(joinedload(CustomerSeat.customer))
    )
    reloaded_seat = await seat_repository.get_one_or_none(seat_statement)

    if not reloaded_seat:
        raise ResourceNotFound("Seat not found after creation")

    return reloaded_seat


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
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    customer = auth_subject.subject

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
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    customer = auth_subject.subject

    seat = await seat_service.get_seat_for_customer(session, customer, seat_id)
    if not seat:
        raise ResourceNotFound("Seat not found")

    return await seat_service.resend_invitation(session, seat)


@router.get(
    "/subscriptions",
    summary="List Claimed Subscriptions",
    response_model=list[CustomerSubscription],
    responses={
        401: {"description": "Authentication required"},
    },
)
async def list_claimed_subscriptions(
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[Subscription]:
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
    )

    subscriptions = await subscription_repository.get_all(statement)

    return list(subscriptions)

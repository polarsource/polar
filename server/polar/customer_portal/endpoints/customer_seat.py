from typing import Annotated
from uuid import UUID

import structlog
from fastapi import Depends, Query
from sqlalchemy.orm import joinedload

from polar.customer_seat.repository import CustomerSeatRepository
from polar.customer_seat.schemas import CustomerSeat as CustomerSeatSchema
from polar.customer_seat.schemas import SeatAssign, SeatsList
from polar.customer_seat.service import seat_service
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.models import CustomerSeat, Product, Subscription
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.subscription.repository import SubscriptionRepository

from .. import auth

log = structlog.get_logger()

router = APIRouter(prefix="/seats", tags=["seats", APITag.public])


@router.get(
    "",
    summary="List Seats",
    response_model=SeatsList,
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription not found"},
    },
)
async def list_seats(
    subscription_id: Annotated[str, Query(description="Subscription ID")],
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> SeatsList:
    customer = auth_subject.subject
    subscription_repository = SubscriptionRepository.from_session(session)

    statement = (
        subscription_repository.get_base_statement()
        .where(Subscription.id == UUID(subscription_id))
        .where(Subscription.customer_id == customer.id)
        .options(
            joinedload(Subscription.product).joinedload(Product.organization),
        )
    )

    subscription = await subscription_repository.get_one_or_none(statement)

    if not subscription:
        raise ResourceNotFound("Subscription not found")

    seats = await seat_service.list_seats(session, subscription)
    available_seats = await seat_service.get_available_seats_count(
        session, subscription
    )

    return SeatsList(
        seats=[CustomerSeatSchema.model_validate(seat) for seat in seats],
        available_seats=available_seats,
        total_seats=subscription.seats or 0,
    )


@router.post(
    "",
    summary="Assign Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "No available seats or customer already has a seat"},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription or customer not found"},
    },
)
async def assign_seat(
    seat_assign: SeatAssign,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    customer = auth_subject.subject

    if not seat_assign.subscription_id:
        raise ResourceNotFound("Subscription ID is required")

    subscription_repository = SubscriptionRepository.from_session(session)

    statement = (
        subscription_repository.get_base_statement()
        .where(Subscription.id == seat_assign.subscription_id)
        .where(Subscription.customer_id == customer.id)
        .options(
            joinedload(Subscription.product).joinedload(Product.organization),
            joinedload(Subscription.customer),
        )
    )

    subscription = await subscription_repository.get_one_or_none(statement)

    if not subscription:
        raise ResourceNotFound("Subscription not found")

    seat = await seat_service.assign_seat(
        session,
        subscription,
        email=seat_assign.email,
        external_customer_id=seat_assign.external_customer_id,
        customer_id=seat_assign.customer_id,
        metadata=seat_assign.metadata,
    )

    await session.commit()

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

    return CustomerSeatSchema.model_validate(reloaded_seat)


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
    seat_id: UUID,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    customer = auth_subject.subject

    seat = await seat_service.get_seat_for_customer(session, customer, seat_id)
    if not seat:
        raise ResourceNotFound("Seat not found")

    revoked_seat = await seat_service.revoke_seat(session, seat)
    await session.commit()

    return CustomerSeatSchema.model_validate(revoked_seat)


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
    seat_id: UUID,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    customer = auth_subject.subject

    seat = await seat_service.get_seat_for_customer(session, customer, seat_id)
    if not seat:
        raise ResourceNotFound("Seat not found")

    resent_seat = await seat_service.resend_invitation(session, seat)
    await session.commit()

    return CustomerSeatSchema.model_validate(resent_seat)

from typing import cast
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.orm import joinedload
from sse_starlette import EventSourceResponse

from polar.auth.models import Anonymous, Organization, User
from polar.auth.models import AuthSubject as AuthSubjectType
from polar.checkout.repository import CheckoutRepository
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Product, Subscription
from polar.models.customer_seat import SeatStatus
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter
from polar.subscription.repository import SubscriptionRepository

from .auth import SeatWriteOrAnonymous
from .repository import CustomerSeatRepository
from .schemas import CustomerSeat as CustomerSeatSchema
from .schemas import (
    CustomerSeatClaimResponse,
    SeatAssign,
    SeatClaim,
    SeatClaimInfo,
    SeatsList,
)
from .service import seat_service

router = APIRouter(
    prefix="/customer-seats",
    tags=["customer-seats", APITag.private],
)


@router.post(
    "",
    summary="Assign Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "No available seats or customer already has a seat"},
        401: {
            "description": "Authentication required for subscription-based assignment"
        },
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription, checkout, or customer not found"},
    },
)
async def assign_seat(
    seat_assign: SeatAssign,
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription: Subscription | None = None

    if seat_assign.subscription_id:
        if isinstance(auth_subject.subject, Anonymous):
            raise NotPermitted(
                "Authentication required for subscription-based assignment"
            )

        typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
        statement = subscription_repository.get_readable_statement(
            typed_auth_subject
        ).where(Subscription.id == seat_assign.subscription_id)

        subscription = await subscription_repository.get_one_or_none(statement)

        if not subscription:
            raise ResourceNotFound("Subscription not found")

    elif seat_assign.checkout_id:
        checkout_repository = CheckoutRepository.from_session(session)
        checkout = await checkout_repository.get_by_id(seat_assign.checkout_id)

        if not checkout:
            raise ResourceNotFound("Checkout not found")

        subscription = await subscription_repository.get_by_checkout_id(
            seat_assign.checkout_id,
            options=(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.customer),
            ),
        )

        if not subscription:
            raise ResourceNotFound("No subscription found for this checkout")

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

    return CustomerSeatSchema.model_validate(seat)


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
    subscription_id: str,
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> SeatsList:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
    subscription_repository = SubscriptionRepository.from_session(session)

    statement = (
        subscription_repository.get_readable_statement(typed_auth_subject)
        .where(Subscription.id == UUID(subscription_id))
        .options(joinedload(Subscription.product).joinedload(Product.organization))
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
    seat_id: str,
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
    seat_repository = CustomerSeatRepository.from_session(session)

    seat = await seat_repository.get_by_id_and_auth_subject(
        typed_auth_subject,
        UUID(seat_id),
        options=seat_repository.get_eager_options(),
    )

    if not seat:
        raise ResourceNotFound("Seat not found")

    seat_service.check_seat_feature_enabled(seat.subscription.product.organization)

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
    seat_id: str,
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
    seat_repository = CustomerSeatRepository.from_session(session)

    seat = await seat_repository.get_by_id_and_auth_subject(
        typed_auth_subject,
        UUID(seat_id),
        options=seat_repository.get_eager_options(),
    )

    if not seat:
        raise ResourceNotFound("Seat not found")

    seat_service.check_seat_feature_enabled(seat.subscription.product.organization)

    resent_seat = await seat_service.resend_invitation(session, seat)
    await session.commit()

    return CustomerSeatSchema.model_validate(resent_seat)


@router.get(
    "/claim/{invitation_token}",
    summary="Get Claim Info",
    response_model=SeatClaimInfo,
    responses={
        400: {"description": "Invalid or expired invitation token"},
        403: {"description": "Seat-based pricing not enabled for organization"},
        404: {"description": "Seat not found"},
    },
)
async def get_claim_info(
    invitation_token: str,
    session: AsyncSession = Depends(get_db_session),
) -> SeatClaimInfo:
    seat = await seat_service.get_seat_by_token(session, invitation_token)

    if not seat:
        raise ResourceNotFound("Invalid or expired invitation token")

    seat_service.check_seat_feature_enabled(seat.subscription.product.organization)

    return SeatClaimInfo(
        product_name=seat.subscription.product.name,
        product_id=seat.subscription.product.id,
        organization_name=seat.subscription.product.organization.name,
        organization_slug=seat.subscription.product.organization.slug,
        customer_email=seat.customer.email if seat.customer else "",
        can_claim=seat.status == SeatStatus.pending,
    )


@router.get("/claim/{invitation_token}/stream", include_in_schema=False)
async def claim_stream(
    request: Request,
    invitation_token: str,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    seat = await seat_service.get_seat_by_token(session, invitation_token)

    if not seat or not seat.customer_id or seat.status != SeatStatus.pending:
        raise ResourceNotFound("Invalid or expired invitation token")

    receivers = Receivers(customer_id=seat.customer_id)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


@router.post(
    "/claim",
    summary="Claim Seat",
    response_model=CustomerSeatClaimResponse,
    responses={
        400: {"description": "Invalid, expired, or already claimed token"},
        403: {"description": "Seat-based pricing not enabled for organization"},
    },
)
async def claim_seat(
    seat_claim: SeatClaim,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatClaimResponse:
    # Capture request metadata for audit logging
    request_metadata = {
        "user_agent": request.headers.get("user-agent"),
        "ip": request.client.host if request.client else None,
    }

    seat, customer_session_token = await seat_service.claim_seat(
        session,
        seat_claim.invitation_token,
        request_metadata,
    )

    return CustomerSeatClaimResponse(
        seat=CustomerSeatSchema.model_validate(seat),
        customer_session_token=customer_session_token,
    )

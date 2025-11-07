from typing import Annotated, cast

from fastapi import Depends, Query, Request
from pydantic import UUID4
from sqlalchemy.orm import joinedload
from sse_starlette import EventSourceResponse

from polar.auth.models import Anonymous, Organization, User
from polar.auth.models import AuthSubject as AuthSubjectType
from polar.checkout.repository import CheckoutRepository
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.models import CustomerSeat, Order, Product, Subscription
from polar.models.customer_seat import SeatStatus
from polar.openapi import APITag
from polar.order.repository import OrderRepository
from polar.organization.repository import OrganizationRepository
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
    tags=["customer-seats", APITag.public],
)


@router.post(
    "",
    summary="Assign Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "No available seats or customer already has a seat"},
        401: {
            "description": "Authentication required for direct subscription or order assignment"
        },
        403: {"description": "Not permitted or seat-based pricing not enabled"},
        404: {"description": "Subscription, order, checkout, or customer not found"},
    },
)
async def assign_seat(
    seat_assign: SeatAssign,
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    # Prevent anonymous users from using immediate_claim
    if isinstance(auth_subject.subject, Anonymous) and seat_assign.immediate_claim:
        raise NotPermitted(
            "Anonymous users cannot use immediate_claim. This feature is only available for authenticated API access."
        )

    subscription: Subscription | None = None
    order: Order | None = None

    if seat_assign.subscription_id:
        if isinstance(auth_subject.subject, Anonymous):
            raise NotPermitted(
                "Authentication required for subscription-based assignment"
            )

        typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
        subscription_repository = SubscriptionRepository.from_session(session)

        statement = (
            subscription_repository.get_readable_statement(typed_auth_subject)
            .options(*subscription_repository.get_eager_options())
            .where(Subscription.id == seat_assign.subscription_id)
        )
        subscription = await subscription_repository.get_one_or_none(statement)

        if not subscription:
            raise ResourceNotFound("Subscription not found")

    elif seat_assign.checkout_id:
        subscription_repository = SubscriptionRepository.from_session(session)
        order_repository = OrderRepository.from_session(session)
        checkout_repository = CheckoutRepository.from_session(session)
        checkout = await checkout_repository.get_by_id(seat_assign.checkout_id)

        if not checkout:
            raise ResourceNotFound("Checkout not found")

        # Try to find subscription first (for recurring purchases)
        subscription = await subscription_repository.get_by_checkout_id(
            seat_assign.checkout_id,
            options=(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.customer),
            ),
        )

        # If no subscription, try to find order (for one-time purchases)
        if not subscription:
            order = await order_repository.get_earliest_by_checkout_id(
                seat_assign.checkout_id,
                options=order_repository.get_eager_options(),
            )
            if not order:
                raise ResourceNotFound(
                    "No subscription or order found for this checkout"
                )

    elif seat_assign.order_id:
        if isinstance(auth_subject.subject, Anonymous):
            raise NotPermitted("Authentication required for order-based assignment")

        typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
        order_repository = OrderRepository.from_session(session)

        order_statement = (
            order_repository.get_readable_statement(typed_auth_subject)
            .options(*order_repository.get_eager_options())
            .where(Order.id == seat_assign.order_id)
        )
        order = await order_repository.get_one_or_none(order_statement)

        if not order:
            raise ResourceNotFound("Order not found")

    if not subscription and not order:
        raise BadRequest(
            "Either subscription_id, checkout_id, or order_id must be provided"
        )

    container = subscription or order
    assert container is not None  # Already validated above

    seat = await seat_service.assign_seat(
        session,
        container,
        email=seat_assign.email,
        external_customer_id=seat_assign.external_customer_id,
        customer_id=seat_assign.customer_id,
        metadata=seat_assign.metadata,
        immediate_claim=seat_assign.immediate_claim,
    )

    return CustomerSeatSchema.model_validate(seat)


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
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    subscription_id: Annotated[UUID4 | None, Query()] = None,
    order_id: Annotated[UUID4 | None, Query()] = None,
) -> SeatsList:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)

    subscription: Subscription | None = None
    order: Order | None = None
    total_seats = 0

    if subscription_id:
        subscription_repository = SubscriptionRepository.from_session(session)

        statement = (
            subscription_repository.get_readable_statement(typed_auth_subject)
            .options(*subscription_repository.get_eager_options())
            .where(Subscription.id == subscription_id)
        )
        subscription = await subscription_repository.get_one_or_none(statement)

        if not subscription:
            raise ResourceNotFound("Subscription not found")

        total_seats = subscription.seats or 0

    elif order_id:
        order_repository = OrderRepository.from_session(session)

        order_statement = (
            order_repository.get_readable_statement(typed_auth_subject)
            .options(*order_repository.get_eager_options())
            .where(Order.id == order_id)
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
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
    seat_repository = CustomerSeatRepository.from_session(session)

    seat = await seat_repository.get_by_id_and_auth_subject(
        typed_auth_subject,
        seat_id,
        options=seat_repository.get_eager_options(),
    )

    if not seat:
        raise ResourceNotFound("Seat not found")

    if seat.subscription:
        organization_id = seat.subscription.product.organization_id
    elif seat.order:
        organization_id = seat.order.organization.id
    else:
        raise ResourceNotFound("Seat has no subscription or order")

    await seat_service.check_seat_feature_enabled(session, organization_id)

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
    auth_subject: SeatWriteOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeat:
    if isinstance(auth_subject.subject, Anonymous):
        raise NotPermitted("Authentication required")

    typed_auth_subject = cast(AuthSubjectType[User | Organization], auth_subject)
    seat_repository = CustomerSeatRepository.from_session(session)

    seat = await seat_repository.get_by_id_and_auth_subject(
        typed_auth_subject,
        seat_id,
        options=seat_repository.get_eager_options(),
    )

    if not seat:
        raise ResourceNotFound("Seat not found")

    if seat.subscription:
        organization_id = seat.subscription.product.organization_id
    elif seat.order:
        organization_id = seat.order.organization.id
    else:
        raise ResourceNotFound("Seat has no subscription or order")

    await seat_service.check_seat_feature_enabled(session, organization_id)

    return await seat_service.resend_invitation(session, seat)


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

    if seat.subscription:
        product = seat.subscription.product
    elif seat.order and seat.order.product:
        product = seat.order.product
    else:
        raise ResourceNotFound("Seat has no subscription or order")

    await seat_service.check_seat_feature_enabled(session, product.organization_id)

    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(product.organization_id)
    if not organization:
        raise ResourceNotFound("Organization not found")

    return SeatClaimInfo(
        product_name=product.name,
        product_id=product.id,
        organization_name=organization.name,
        organization_slug=organization.slug,
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

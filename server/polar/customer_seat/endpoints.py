from typing import cast

from fastapi import Depends
from sqlalchemy.orm import joinedload

from polar.auth.models import Anonymous, Organization, User
from polar.auth.models import AuthSubject as AuthSubjectType
from polar.checkout.repository import CheckoutRepository
from polar.customer.auth import CustomerRead
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Product, Subscription
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.subscription.repository import SubscriptionRepository

from .auth import SeatWriteOrAnonymous
from .schemas import CustomerSeat as CustomerSeatSchema
from .schemas import SeatAssign, SeatClaim
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


@router.post(
    "/claim",
    summary="Claim Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "Invalid or expired invitation token"},
        403: {"description": "Seat-based pricing not enabled for organization"},
        404: {"description": "Customer not found"},
    },
)
async def claim_seat(
    seat_claim: SeatClaim,
    auth_subject: CustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    if not hasattr(auth_subject.subject, "id"):
        raise ResourceNotFound()
    raise NotImplementedError(
        "Seat claiming endpoint needs customer authentication implementation"
    )

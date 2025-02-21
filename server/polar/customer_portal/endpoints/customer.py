from fastapi import Depends, Request
from sse_starlette import EventSourceResponse

from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource
from polar.models import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer import (
    CustomerPaymentMethod,
    CustomerPaymentMethodCreate,
    CustomerPortalCustomer,
    CustomerPortalCustomerUpdate,
)
from ..service.customer import customer as customer_service

router = APIRouter(prefix="/customers", tags=["customers", APITag.documented])


@router.get("/stream", include_in_schema=False)
async def stream(
    request: Request,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(customer_id=auth_subject.subject.id)
    channels = receivers.get_channels()
    return EventSourceResponse(subscribe(redis, channels, request))


@router.get("/me", summary="Get Customer", response_model=CustomerPortalCustomer)
async def get(auth_subject: auth.CustomerPortalRead) -> Customer:
    """Get authenticated customer."""
    return auth_subject.subject


@router.patch(
    "/me",
    summary="Update Customer",
    responses={
        200: {"description": "Customer updated."},
    },
    response_model=CustomerPortalCustomer,
)
async def update(
    customer_update: CustomerPortalCustomerUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Update authenticated customer."""
    return await customer_service.update(session, auth_subject.subject, customer_update)


@router.get(
    "/me/payment-methods",
    summary="Get Customer Payment Methods",
    response_model=ListResource[CustomerPaymentMethod],
)
async def get_payment_methods(
    auth_subject: auth.CustomerPortalRead,
) -> ListResource[CustomerPaymentMethod]:
    """Get saved payment methods of the authenticated customer."""
    return await customer_service.list_payment_methods(auth_subject.subject)


@router.post(
    "/me/payment-methods",
    summary="Add Customer Payment Method",
    status_code=201,
    responses={
        201: {"description": "Payment method created."},
    },
    response_model=CustomerPaymentMethod,
)
async def add_payment_method(
    auth_subject: auth.CustomerPortalRead,
    payment_method_create: CustomerPaymentMethodCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerPaymentMethod:
    """Add a payment method to the authenticated customer."""
    return await customer_service.add_payment_method(
        session, auth_subject.subject, payment_method_create
    )


@router.delete(
    "/me/payment-methods/{id}",
    summary="Delete Customer Payment Method",
    status_code=204,
    responses={
        204: {"description": "Payment method deleted."},
        404: {
            "description": "Payment method not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def delete_payment_method(id: str, auth_subject: auth.CustomerPortalRead) -> None:
    """Delete a payment method from the authenticated customer."""
    return await customer_service.delete_payment_method(auth_subject.subject, id)

import json

import structlog
from fastapi import Depends, Request
from fastapi.responses import Response
from pydantic import UUID4
from sse_starlette import EventSourceResponse

from polar.customer.service import customer as main_customer_service
from polar.customer_email_update.schemas import (
    CustomerEmailUpdateRequest,
    CustomerEmailUpdateVerifyRequest,
    CustomerEmailUpdateVerifyResponse,
)
from polar.customer_email_update.service import (
    InvalidCustomerEmailUpdate,
)
from polar.customer_email_update.service import (
    customer_email_update as customer_email_update_service,
)
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Customer
from polar.openapi import APITag
from polar.payment_method.service import PaymentMethodInUseByActiveSubscription
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer import (
    CustomerPaymentMethod,
    CustomerPaymentMethodConfirm,
    CustomerPaymentMethodCreate,
    CustomerPaymentMethodCreateResponse,
    CustomerPaymentMethodTypeAdapter,
    CustomerPortalCustomer,
    CustomerPortalCustomerUpdate,
)
from ..service.customer import CustomerNotReady
from ..service.customer import customer as customer_service
from ..utils import get_audit_context, get_customer, get_customer_id

log = structlog.get_logger()

router = APIRouter(prefix="/customers", tags=["customers", APITag.public])


@router.get("/stream", include_in_schema=False)
async def stream(
    request: Request,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    await session.commit()
    receivers = Receivers(customer_id=get_customer_id(auth_subject))
    channels = receivers.get_channels()
    return EventSourceResponse(subscribe(redis, channels, request))


@router.get("/me", summary="Get Customer", response_model=CustomerPortalCustomer)
async def get(auth_subject: auth.CustomerPortalUnionRead) -> Customer:
    """Get authenticated customer."""
    return get_customer(auth_subject)


@router.get(
    "/me/export",
    summary="Export Customer Data",
    tags=[APITag.private],
    responses={
        200: {
            "content": {"application/json": {"schema": {"type": "object"}}},
            "description": "Customer data exported as a JSON file.",
        }
    },
)
async def export(
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Response:
    """Export all data for the authenticated customer as a JSON file."""
    customer = get_customer(auth_subject)
    data = await main_customer_service.get_export(session, customer)
    filename = f"polar-customer-export-{customer.id}.json"
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


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
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Update authenticated customer."""
    return await customer_service.update(
        session, get_customer(auth_subject), customer_update
    )


@router.get(
    "/me/payment-methods",
    summary="List Customer Payment Methods",
    response_model=ListResource[CustomerPaymentMethod],
)
async def list_payment_methods(
    auth_subject: auth.CustomerPortalUnionBillingRead,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerPaymentMethod]:
    """Get saved payment methods of the authenticated customer."""
    results, count = await customer_service.list_payment_methods(
        session, auth_subject, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [
            CustomerPaymentMethodTypeAdapter.validate_python(result)
            for result in results
        ],
        count,
        pagination,
    )


@router.post(
    "/me/payment-methods",
    summary="Add Customer Payment Method",
    status_code=201,
    responses={
        201: {"description": "Payment method created or setup initiated."},
    },
    response_model=CustomerPaymentMethodCreateResponse,
)
async def add_payment_method(
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    payment_method_create: CustomerPaymentMethodCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerPaymentMethodCreateResponse:
    """Add a payment method to the authenticated customer."""
    log.info(
        "customer_portal.payment_method.add",
        **get_audit_context(auth_subject),
    )
    return await customer_service.add_payment_method(
        session, get_customer(auth_subject), payment_method_create
    )


@router.post(
    "/me/payment-methods/confirm",
    summary="Confirm Customer Payment Method",
    status_code=201,
    responses={
        201: {"description": "Payment method created or setup initiated."},
        400: {
            "description": "Customer is not ready to confirm a payment method.",
            "model": CustomerNotReady.schema(),
        },
    },
    response_model=CustomerPaymentMethodCreateResponse,
)
async def confirm_payment_method(
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    payment_method_confirm: CustomerPaymentMethodConfirm,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerPaymentMethodCreateResponse:
    """Confirm a payment method for the authenticated customer."""
    return await customer_service.confirm_payment_method(
        session, get_customer(auth_subject), payment_method_confirm
    )


@router.delete(
    "/me/payment-methods/{id}",
    summary="Delete Customer Payment Method",
    status_code=204,
    responses={
        204: {"description": "Payment method deleted."},
        400: {
            "description": "Payment method is used by active subscription(s).",
            "model": PaymentMethodInUseByActiveSubscription.schema(),
        },
        404: {
            "description": "Payment method not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def delete_payment_method(
    id: UUID4,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a payment method from the authenticated customer."""
    payment_method = await customer_service.get_payment_method(
        session, auth_subject, id
    )
    if payment_method is None:
        raise ResourceNotFound()
    log.info(
        "customer_portal.payment_method.delete",
        payment_method_id=id,
        **get_audit_context(auth_subject),
    )
    await customer_service.delete_payment_method(session, payment_method)


@router.post(
    "/me/email-update/request",
    summary="Request Email Change",
    status_code=202,
    responses={
        202: {"description": "Verification email sent."},
    },
)
async def request_email_update(
    body: CustomerEmailUpdateRequest,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Request an email change for the authenticated customer."""
    customer = get_customer(auth_subject)

    # Load organization for building the verification URL
    await session.refresh(customer, ["organization"])

    log.info(
        "customer_portal.email_update.request",
        customer_id=customer.id,
        new_email=body.email,
    )

    record, token = await customer_email_update_service.request_email_update(
        session, customer, body.email
    )
    await customer_email_update_service.send_verification_email(
        record, token, customer.organization
    )


# No auth required: the verification token serves as proof of email inbox
# access. Called from the server component before the page renders.
@router.get(
    "/me/email-update/check",
    summary="Check Email Change Token",
    status_code=204,
    responses={
        204: {"description": "Token is valid."},
        401: {"description": "Invalid or expired verification token."},
    },
)
async def check_email_update(
    token: str,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    """Check if an email change verification token is still valid."""
    valid = await customer_email_update_service.check_token(session, token)
    if not valid:
        raise InvalidCustomerEmailUpdate()


# No auth required: the verification token serves as proof of email inbox
# access. A new customer session is returned on success.
@router.post(
    "/me/email-update/verify",
    summary="Verify Email Change",
    response_model=CustomerEmailUpdateVerifyResponse,
    responses={
        200: {"description": "Email updated successfully."},
        401: {"description": "Invalid or expired verification token."},
        422: {"description": "Email address is already in use."},
    },
)
async def verify_email_update(
    body: CustomerEmailUpdateVerifyRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerEmailUpdateVerifyResponse:
    """Verify an email change using the token from the verification email."""
    customer, session_token = await customer_email_update_service.verify(
        session, body.token
    )

    log.info(
        "customer_portal.email_update.verified",
        customer_id=customer.id,
        new_email=customer.email,
    )

    return CustomerEmailUpdateVerifyResponse(token=session_token)

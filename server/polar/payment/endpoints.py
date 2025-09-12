from fastapi import Depends, Query
from pydantic.types import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Payment
from polar.models.payment import PaymentStatus
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Payment as PaymentSchema
from .schemas import PaymentAdapter, PaymentID
from .service import payment as payment_service

router = APIRouter(prefix="/payments", tags=["payments", APITag.public, APITag.mcp])


PaymentNotFound = {
    "description": "Payment not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Payments", response_model=ListResource[PaymentSchema])
async def list(
    auth_subject: auth.PaymentRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    checkout_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="CheckoutID Filter", description="Filter by checkout ID."
    ),
    order_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="OrderID Filter", description="Filter by order ID."
    ),
    status: MultipleQueryFilter[PaymentStatus] | None = Query(
        None, title="Status Filter", description="Filter by payment status."
    ),
    method: MultipleQueryFilter[str] | None = Query(
        None, title="Method Filter", description="Filter by payment method."
    ),
    customer_email: MultipleQueryFilter[str] | None = Query(
        None, title="CustomerEmail Filter", description="Filter by customer email."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[PaymentSchema]:
    """List payments."""
    results, count = await payment_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        checkout_id=checkout_id,
        order_id=order_id,
        status=status,
        method=method,
        customer_email=customer_email,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [PaymentAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Payment",
    response_model=PaymentSchema,
    responses={404: PaymentNotFound},
)
async def get(
    id: PaymentID,
    auth_subject: auth.PaymentRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Payment:
    """Get a payment by ID."""
    payment = await payment_service.get(session, auth_subject, id)

    if payment is None:
        raise ResourceNotFound()

    return payment

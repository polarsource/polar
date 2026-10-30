from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Payment
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Payment as PaymentSchema
from .schemas import PaymentAdapter, PaymentID, PaymentListParams
from .service import payment as payment_service

router = APIRouter(
    prefix="/payments", tags=["payments", APITag.public, APITag.mcp, APITag.cli]
)


PaymentNotFound = {
    "description": "Payment not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Payments", response_model=ListResource[PaymentSchema])
async def list(
    filters: Annotated[PaymentListParams, Query()],
    auth_subject: auth.PaymentRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[PaymentSchema]:
    """List payments."""
    results, count = await payment_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        checkout_id=filters.checkout_id,
        order_id=filters.order_id,
        customer_id=filters.customer_id,
        status=filters.status,
        method=filters.method,
        customer_email=filters.customer_email,
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

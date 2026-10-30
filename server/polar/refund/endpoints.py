from typing import Annotated

from fastapi import Depends, Query

from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Refund
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import Refund as RefundSchema
from .schemas import RefundCreate, RefundListParams
from .service import RefundedAlready
from .service import refund as refund_service
from .sorting import RefundListSorting

router = APIRouter(
    prefix="/refunds", tags=["refunds", APITag.public, APITag.mcp, APITag.cli]
)


@router.get("/", summary="List Refunds", response_model=ListResource[RefundSchema])
async def list(
    filters: Annotated[RefundListParams, Query()],
    pagination: PaginationParamsQuery,
    sorting: RefundListSorting,
    auth_subject: auth.RefundsRead,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[RefundSchema]:
    """List refunds."""
    results, count = await refund_service.list(
        session,
        auth_subject,
        id=filters.id,
        organization_id=filters.organization_id,
        order_id=filters.order_id,
        subscription_id=filters.subscription_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        succeeded=filters.succeeded,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [RefundSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/",
    summary="Create Refund",
    response_model=RefundSchema,
    status_code=201,
    responses={
        201: {"description": "Refund created."},
        403: {
            "description": "Order is already fully refunded.",
            "model": RefundedAlready.schema(),
        },
    },
)
async def create(
    refund_create: RefundCreate,
    auth_subject: auth.RefundsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Refund:
    """Create a refund."""
    return await refund_service.user_create(
        session,
        auth_subject,
        create_schema=refund_create,
    )

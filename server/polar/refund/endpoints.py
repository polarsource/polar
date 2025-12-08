from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Refund
from polar.openapi import APITag
from polar.order.schemas import OrderID
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.subscription.schemas import SubscriptionID

from . import auth
from .schemas import Refund as RefundSchema
from .schemas import RefundCreate, RefundID
from .service import RefundedAlready
from .service import refund as refund_service
from .sorting import RefundListSorting

router = APIRouter(prefix="/refunds", tags=["refunds", APITag.public])


@router.get("/", summary="List Refunds", response_model=ListResource[RefundSchema])
async def list(
    pagination: PaginationParamsQuery,
    sorting: RefundListSorting,
    auth_subject: auth.RefundsRead,
    id: MultipleQueryFilter[RefundID] | None = Query(
        None, title="RefundID Filter", description="Filter by refund ID."
    ),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    order_id: MultipleQueryFilter[OrderID] | None = Query(
        None, title="OrderID Filter", description="Filter by order ID."
    ),
    subscription_id: MultipleQueryFilter[SubscriptionID] | None = Query(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    succeeded: bool | None = Query(
        None,
        title="RefundStatus Filter",
        description="Filter by `succeeded`.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[RefundSchema]:
    """List refunds."""
    results, count = await refund_service.list(
        session,
        auth_subject,
        id=id,
        organization_id=organization_id,
        order_id=order_id,
        subscription_id=subscription_id,
        customer_id=customer_id,
        succeeded=succeeded,
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

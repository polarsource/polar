from fastapi import Depends, Query
from pydantic import UUID4

from polar.customer.schemas import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Order
from polar.models.product_price import ProductPriceType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Order as OrderSchema
from .schemas import OrderID, OrderInvoice, OrderNotFound
from .service import order as order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.documented])


@router.get("/", summary="List Orders", response_model=ListResource[OrderSchema])
async def list(
    auth_subject: auth.OrdersRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    product_price_type: MultipleQueryFilter[ProductPriceType] | None = Query(
        None,
        title="ProductPriceType Filter",
        description=(
            "Filter by product price type. "
            "`recurring` will return orders corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will return orders corresponding to one-time purchases."
        ),
    ),
    discount_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="DiscountID Filter", description="Filter by discount ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrderSchema]:
    """List orders."""
    results, count = await order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
        discount_id=discount_id,
        customer_id=customer_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrderSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Order",
    response_model=OrderSchema,
    responses={404: OrderNotFound},
)
async def get(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Get an order by ID."""
    order = await order_service.user_get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return order


@router.get(
    "/{id}/invoice",
    summary="Get Order Invoice",
    response_model=OrderInvoice,
    responses={404: OrderNotFound},
)
async def invoice(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> OrderInvoice:
    """Get an order's invoice data."""
    order = await order_service.user_get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    invoice_url = await order_service.get_order_invoice_url(order)

    return OrderInvoice(url=invoice_url)

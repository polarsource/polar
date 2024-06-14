from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Order
from polar.models.product_price import ProductPriceType
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Order as OrderSchema
from .schemas import OrderInvoice
from .service import order as order_service

router = APIRouter(prefix="/orders", tags=["orders"])


OrderID = Annotated[UUID4, Path(description="The order ID.")]
OrderNotFound = {"description": "Order not found.", "model": ResourceNotFound.schema()}


@router.get("/", response_model=ListResource[OrderSchema])
async def list_orders(
    auth_subject: auth.OrdersRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    product_id: UUID4 | None = Query(None, description="Filter by product ID."),
    product_price_type: ProductPriceType | None = Query(
        None,
        description=(
            "Filter by product price type. "
            "`recurring` will return orders corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will return orders corresponding to one-time purchases."
        ),
    ),
    user_id: UUID4 | None = Query(None, description="Filter by customer's user ID."),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrderSchema]:
    """List orders."""
    results, count = await order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
        user_id=user_id,
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
    response_model=OrderSchema,
    responses={404: OrderNotFound},
)
async def get_order(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Get an order by ID."""
    order = await order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return order


@router.get(
    "/{id}/invoice",
    response_model=OrderInvoice,
    responses={404: OrderNotFound},
)
async def get_order_invoice(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> OrderInvoice:
    """Get an order's invoice data."""
    order = await order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    invoice_url = await order_service.get_order_invoice_url(order)

    return OrderInvoice(url=invoice_url)

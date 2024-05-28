from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Order
from polar.models.product_price import ProductPriceType
from polar.postgres import get_db_session
from polar.tags.api import Tags

from .. import auth
from ..schemas.order import UserOrder, UserOrderInvoice
from ..service.order import SortProperty
from ..service.order import user_order as user_order_service

router = APIRouter(prefix="/orders")

OrderID = Annotated[UUID4, Path(description="The order ID.")]
OrderNotFound = {"description": "Order not found.", "model": ResourceNotFound.schema()}

ListSorting = Annotated[
    list[Sorting[SortProperty]],
    Depends(SortingGetter(SortProperty, ["-created_at"])),
]


@router.get("/", response_model=ListResource[UserOrder], tags=[Tags.PUBLIC])
async def list_orders(
    auth_subject: auth.UserOrdersRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
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
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[UserOrder]:
    """List orders."""
    results, count = await user_order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [UserOrder.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    response_model=UserOrder,
    tags=[Tags.PUBLIC],
    responses={404: OrderNotFound},
)
async def get_order(
    id: OrderID,
    auth_subject: auth.UserOrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Get an order by ID."""
    order = await user_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return order


@router.get(
    "/{id}/invoice",
    response_model=UserOrderInvoice,
    tags=[Tags.PUBLIC],
    responses={404: OrderNotFound},
)
async def get_order_invoice(
    id: OrderID,
    auth_subject: auth.UserOrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> UserOrderInvoice:
    """Get an order's invoice data."""
    order = await user_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    invoice_url = await user_order_service.get_order_invoice_url(order)

    return UserOrderInvoice(url=invoice_url)

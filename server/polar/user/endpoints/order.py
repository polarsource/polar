from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Order
from polar.models.product_price import ProductPriceType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from .. import auth
from ..schemas.order import UserOrder, UserOrderInvoice
from ..service.order import UserOrderSortProperty
from ..service.order import user_order as user_order_service

router = APIRouter(prefix="/orders", tags=[APITag.documented, APITag.featured])

OrderID = Annotated[UUID4, Path(description="The order ID.")]
OrderNotFound = {"description": "Order not found.", "model": ResourceNotFound.schema()}

ListSorting = Annotated[
    list[Sorting[UserOrderSortProperty]],
    Depends(SortingGetter(UserOrderSortProperty, ["-created_at"])),
]


@router.get("/", response_model=ListResource[UserOrder])
async def list_orders(
    auth_subject: auth.UserOrdersRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
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
    subscription_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    ),
    query: str | None = Query(
        None, description="Search by product or organization name."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[UserOrder]:
    """List my orders."""
    results, count = await user_order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
        subscription_id=subscription_id,
        query=query,
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

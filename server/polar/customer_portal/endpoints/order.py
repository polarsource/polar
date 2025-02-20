from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Order
from polar.models.product_price import ProductPriceType
from polar.openapi import APITag
from polar.order.schemas import OrderID
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter
from polar.subscription.schemas import SubscriptionID

from .. import auth
from ..schemas.order import CustomerOrder, CustomerOrderInvoice
from ..service.order import CustomerOrderSortProperty
from ..service.order import customer_order as customer_order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.documented])

OrderNotFound = {"description": "Order not found.", "model": ResourceNotFound.schema()}

ListSorting = Annotated[
    list[Sorting[CustomerOrderSortProperty]],
    Depends(SortingGetter(CustomerOrderSortProperty, ["-created_at"])),
]


@router.get("/", summary="List Orders", response_model=ListResource[CustomerOrder])
async def list(
    auth_subject: auth.CustomerPortalRead,
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
    subscription_id: MultipleQueryFilter[SubscriptionID] | None = Query(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    ),
    query: str | None = Query(
        None, description="Search by product or organization name."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerOrder]:
    """List orders of the authenticated customer."""
    results, count = await customer_order_service.list(
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
        [CustomerOrder.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Order",
    response_model=CustomerOrder,
    responses={404: OrderNotFound},
)
async def get(
    id: OrderID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Get an order by ID for the authenticated customer."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return order


@router.get(
    "/{id}/invoice",
    summary="Get Order Invoice",
    response_model=CustomerOrderInvoice,
    responses={404: OrderNotFound},
)
async def invoice(
    id: OrderID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerOrderInvoice:
    """Get an order's invoice data."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    invoice_url = await customer_order_service.get_order_invoice_url(order)

    return CustomerOrderInvoice(url=invoice_url)

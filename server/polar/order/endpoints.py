from fastapi import Depends, Query
from pydantic import UUID4

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Order
from polar.models.product import ProductBillingType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Order as OrderSchema
from .schemas import OrderID, OrderInvoice, OrderNotFound, OrderUpdate
from .service import InvoiceAlreadyExists, MissingInvoiceBillingDetails, NotPaidOrder
from .service import order as order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.public, APITag.mcp])


@router.get(
    "/",
    summary="List Orders",
    response_model=ListResource[OrderSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.OrdersRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    product_billing_type: MultipleQueryFilter[ProductBillingType] | None = Query(
        None,
        title="ProductBillingType Filter",
        description=(
            "Filter by product billing type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    ),
    discount_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="DiscountID Filter", description="Filter by discount ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    checkout_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="CheckoutID Filter", description="Filter by checkout ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrderSchema]:
    """List orders."""
    results, count = await order_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        product_billing_type=product_billing_type,
        discount_id=discount_id,
        customer_id=customer_id,
        checkout_id=checkout_id,
        metadata=metadata,
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
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Order:
    """Get an order by ID."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return order


@router.patch(
    "/{id}",
    summary="Update Order",
    response_model=OrderSchema,
    responses={404: OrderNotFound},
)
async def update(
    id: OrderID,
    order_update: OrderUpdate,
    auth_subject: auth.OrdersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update an order."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return await order_service.update(session, order, order_update)


@router.post(
    "/{id}/invoice",
    status_code=202,
    summary="Generate Order Invoice",
    responses={
        409: {
            "description": "Order already has an invoice.",
            "model": InvoiceAlreadyExists.schema(),
        },
        422: {
            "description": "Order is not paid or is missing billing name or address.",
            "model": MissingInvoiceBillingDetails.schema() | NotPaidOrder.schema(),
        },
    },
)
async def generate_invoice(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Trigger generation of an order's invoice."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    await order_service.trigger_invoice_generation(session, order)


@router.get(
    "/{id}/invoice",
    summary="Get Order Invoice",
    response_model=OrderInvoice,
    responses={404: OrderNotFound},
)
async def invoice(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrderInvoice:
    """Get an order's invoice data."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return await order_service.get_order_invoice(order)

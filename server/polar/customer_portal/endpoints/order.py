from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Order
from polar.models.product import ProductBillingType
from polar.openapi import APITag
from polar.order.schemas import OrderID
from polar.order.service import (
    MissingInvoiceBillingDetails,
    NotPaidOrder,
    PaymentAlreadyInProgress,
)
from polar.payment.repository import PaymentRepository
from polar.postgres import get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter
from polar.subscription.schemas import SubscriptionID

from .. import auth
from ..schemas.order import (
    CustomerOrder,
    CustomerOrderConfirmPayment,
    CustomerOrderInvoice,
    CustomerOrderPaymentConfirmation,
    CustomerOrderPaymentStatus,
    CustomerOrderUpdate,
)
from ..service.order import CustomerOrderSortProperty, OrderNotEligibleForRetry
from ..service.order import customer_order as customer_order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.public])

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
        product_id=product_id,
        product_billing_type=product_billing_type,
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


@router.patch(
    "/{id}",
    summary="Update Order",
    response_model=CustomerOrder,
    responses={404: OrderNotFound},
)
async def update(
    id: OrderID,
    order_update: CustomerOrderUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update an order for the authenticated customer."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return await customer_order_service.update(session, order, order_update)


@router.post(
    "/{id}/invoice",
    status_code=202,
    summary="Generate Order Invoice",
    responses={
        422: {
            "description": "Order is not paid or is missing billing name or address.",
            "model": MissingInvoiceBillingDetails.schema() | NotPaidOrder.schema(),
        },
    },
)
async def generate_invoice(
    id: OrderID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Trigger generation of an order's invoice."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    await customer_order_service.trigger_invoice_generation(session, order)


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

    return await customer_order_service.get_order_invoice(order)


@router.get(
    "/{id}/payment-status",
    summary="Get Order Payment Status",
    response_model=CustomerOrderPaymentStatus,
    responses={404: OrderNotFound},
)
async def get_payment_status(
    id: OrderID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerOrderPaymentStatus:
    """Get the current payment status for an order."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    payment_repository = PaymentRepository.from_session(session)
    payment = await payment_repository.get_latest_for_order(order.id)

    if payment is None:
        return CustomerOrderPaymentStatus(
            status="no_payment",
            error=None,
        )

    return CustomerOrderPaymentStatus(
        status=payment.status,
        error=payment.decline_message if payment.decline_message is not None else None,
    )


@router.post(
    "/{id}/confirm-payment",
    summary="Confirm Retry Payment",
    response_model=CustomerOrderPaymentConfirmation,
    responses={
        404: OrderNotFound,
        409: {
            "description": "Payment already in progress.",
            "model": PaymentAlreadyInProgress.schema(),
        },
        422: {
            "description": "Order not eligible for retry or payment confirmation failed.",
            "model": OrderNotEligibleForRetry.schema(),
        },
    },
)
async def confirm_retry_payment(
    id: OrderID,
    confirm_data: CustomerOrderConfirmPayment,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerOrderPaymentConfirmation:
    """Confirm a retry payment using a Stripe confirmation token."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return await customer_order_service.confirm_retry_payment(
        session,
        order,
        confirm_data.confirmation_token_id,
        confirm_data.payment_processor,
        confirm_data.payment_method_id,
    )

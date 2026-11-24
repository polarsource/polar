from textwrap import dedent
from typing import Annotated

from fastapi import Depends, Query, Response
from fastapi.responses import JSONResponse

from polar.auth.scope import Scope
from polar.exceptions import PaymentNotReady, ResourceNotFound
from polar.kit.db.postgres import AsyncSession, AsyncSessionMaker
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.kit.versioning import version
from polar.models import Order
from polar.openapi import APITag, destructive
from polar.order.schemas import OrderID
from polar.order.service import (
    CustomerOrderConflict,
    CustomerOrderPaymentDeclined,
    MissingInvoiceBillingDetails,
    OrderNotEligibleForInvoice,
    PaymentAlreadyInProgress,
)
from polar.order.service import order as order_service
from polar.payment.repository import PaymentRepository
from polar.postgres import get_db_session, get_db_sessionmaker
from polar.routing import APIRouter
from polar.subscription.service import NotTrialEndedSubscription
from polar.version import NEXT_API_VERSION, V2026_10

from .. import auth
from ..schemas.order import (
    CustomerOrder,
    CustomerOrderConfirmPayment,
    CustomerOrderCreate,
    CustomerOrderInvoice,
    CustomerOrderPay,
    CustomerOrderPaymentConfirmation,
    CustomerOrderPaymentStatus,
    CustomerOrderReceipt,
    CustomerOrderUpdate,
    CustomerPortalOrderListParams,
)
from ..service.order import (
    CustomerOrderSortProperty,
    ManualRetryLimitExceeded,
    OrderNotEligibleForRetry,
)
from ..service.order import customer_order as customer_order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.public])

GENERATE_INVOICE_MINTLIFY_CONTENT = dedent(
    """
    <Warning>
      Once the invoice is generated, it's permanent and cannot be modified.

      Make sure the billing details (name and address) are correct before generating the invoice. You can update them before generating the invoice by calling the [`PATCH /v1/customer-portal/orders/{id}`](/api-reference/customer_portal/update-order) endpoint.
    </Warning>

    <Note>
      After successfully calling this endpoint, you get a `202` response, meaning the generation of the invoice has been scheduled. It usually only takes a few seconds before you can retrieve the invoice using the [`GET /v1/customer-portal/orders/{id}/invoice`](/api-reference/customer_portal/get-order-invoice) endpoint.

      If you want a reliable notification when the invoice is ready, you can listen to the [`order.updated`](/api-reference/orderupdated) webhook and check the [`is_invoice_generated` field](/api-reference/orderupdated#schema-data-is-invoice-generated).
    </Note>
    """
).strip()

GET_INVOICE_MINTLIFY_CONTENT = dedent(
    """
    <Note>
      The invoice must be generated first before it can be retrieved. You should call the [`POST /v1/customer-portal/orders/{id}/invoice`](/api-reference/customer_portal/generate-order-invoice) endpoint to generate the invoice.

      If the invoice is not generated, you will receive a `404` error.
    </Note>
    """
).strip()

OrderNotFound = {"description": "Order not found.", "model": ResourceNotFound.schema()}

ListSorting = Annotated[
    list[Sorting[CustomerOrderSortProperty]],
    Depends(SortingGetter(CustomerOrderSortProperty, ["-created_at"])),
]


@router.get("/", summary="List Orders", response_model=ListResource[CustomerOrder])
async def list(
    filters: Annotated[CustomerPortalOrderListParams, Query()],
    auth_subject: auth.CustomerPortalUnionBillingRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerOrder]:
    """List orders of the authenticated customer."""
    results, count = await customer_order_service.list(
        session,
        auth_subject,
        product_id=filters.product_id,
        product_billing_type=filters.product_billing_type,
        subscription_id=filters.subscription_id,
        query=filters.query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [
            CustomerOrder.model_validate(result).model_copy(
                update={"payment_processor_metadata": {}}
            )
            for result in results
        ],
        count,
        pagination,
    )


@router.post(
    "/",
    status_code=201,
    summary="Create Order",
    response_model=CustomerOrder,
    responses={
        404: {
            "description": "Subscription not found.",
            "model": ResourceNotFound.schema(),
        },
        409: {"model": NotTrialEndedSubscription.schema()},
    },
)
@version(starting_from=NEXT_API_VERSION)
async def create(
    order_create: CustomerOrderCreate,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Prepare a draft order for the first paid period of an ended trial."""
    return await customer_order_service.create(
        session, auth_subject, order_create.subscription_id
    )


@router.get(
    "/{id}",
    summary="Get Order",
    response_model=CustomerOrder,
    responses={404: OrderNotFound},
)
async def get(
    id: OrderID,
    auth_subject: auth.CustomerPortalUnionBillingRead,
    session: AsyncSession = Depends(get_db_session),
) -> Order | CustomerOrder:
    """Get an order by ID for the authenticated customer."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    if Scope.customer_portal_write not in auth_subject.scopes:
        return CustomerOrder.model_validate(order).model_copy(
            update={"payment_processor_metadata": {}}
        )
    return order


@router.patch(
    "/{id}",
    summary="Update Order",
    response_model=CustomerOrder,
    responses={404: OrderNotFound},
)
@version(up_to=V2026_10)
async def update(
    id: OrderID,
    order_update: CustomerOrderUpdate,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update an order for the authenticated customer."""
    order = await customer_order_service.get_by_id(
        session, auth_subject, id, for_update=True
    )
    if order is None:
        raise ResourceNotFound()
    return await customer_order_service.update(session, order, order_update)


@router.patch(
    "/{id}",
    name="update",
    summary="Update Order",
    response_model=CustomerOrder,
    responses={
        404: OrderNotFound,
        409: {
            "model": CustomerOrderConflict.schema()
            | PaymentAlreadyInProgress.schema()
            | NotTrialEndedSubscription.schema()
        },
    },
)
@version(starting_from=NEXT_API_VERSION)
async def update_v2027_01(
    id: OrderID,
    order_update: CustomerOrderUpdate,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update billing details. Tax and discount changes are available on trial recovery drafts."""
    return await update(id, order_update, auth_subject, session)


@router.patch(
    "/{id}/pay",
    summary="Pay Order",
    response_model=CustomerOrder,
    openapi_extra=destructive(),
    responses={
        202: {
            "model": CustomerOrder,
            "description": "Payment is processing or requires authentication.",
        },
        402: {"model": CustomerOrderPaymentDeclined.schema()},
        403: {"model": PaymentNotReady.schema()},
        404: OrderNotFound,
        409: {
            "model": CustomerOrderConflict.schema()
            | PaymentAlreadyInProgress.schema()
            | NotTrialEndedSubscription.schema()
        },
        429: {"model": ManualRetryLimitExceeded.schema()},
    },
)
@version(starting_from=NEXT_API_VERSION)
async def pay(
    id: OrderID,
    credential: CustomerOrderPay,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    response: Response,
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> Order | JSONResponse:
    """Pay an outstanding subscription order or start the paid period of an ended trial."""
    # Persist the locked snapshot before Stripe can emit a settlement webhook.
    async with sessionmaker.begin() as preparation:
        order = await customer_order_service.get_by_id(
            preparation, auth_subject, id, for_update=True
        )
        if order is None:
            raise ResourceNotFound()
        stripe_credential = await order_service.prepare_customer_order_payment(
            preparation, order, credential
        )

    if (
        intent_id := order.payment_processor_metadata.get("intent_id")
    ) is not None and not order.payment_authentication:
        async with sessionmaker.begin() as settlement:
            order = await customer_order_service.get_by_id(
                settlement, auth_subject, id, for_update=True
            )
            if order is None:
                raise ResourceNotFound()
            try:
                if stripe_credential is not None:
                    order = await order_service.confirm_customer_order_payment(
                        settlement, order, intent_id, stripe_credential
                    )
                elif order.payment_processor_metadata.get("intent_id") == intent_id:
                    order = await order_service.reconcile_customer_order_payment(
                        settlement, order
                    )
            except CustomerOrderPaymentDeclined as e:
                return JSONResponse(
                    status_code=e.status_code,
                    content={"error": type(e).__name__, "detail": e.detail},
                )
    if not order.paid:
        response.status_code = 202
    return order


@router.post(
    "/{id}/invoice",
    status_code=202,
    summary="Generate Order Invoice",
    responses={
        404: OrderNotFound,
        409: {
            "description": "Order is not eligible for invoice generation (invalid status).",
            "model": OrderNotEligibleForInvoice.schema(),
        },
        422: {
            "description": "Order is missing billing name or address.",
            "model": MissingInvoiceBillingDetails.schema(),
        },
    },
    openapi_extra={"x-mint": {"content": GENERATE_INVOICE_MINTLIFY_CONTENT}},
)
async def generate_invoice(
    id: OrderID,
    auth_subject: auth.CustomerPortalUnionBillingRead,
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
    openapi_extra={"x-mint": {"content": GET_INVOICE_MINTLIFY_CONTENT}},
)
async def invoice(
    id: OrderID,
    auth_subject: auth.CustomerPortalUnionBillingRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerOrderInvoice:
    """Get an order's invoice data."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    return await customer_order_service.get_order_invoice(order)


@router.get(
    "/{id}/receipt",
    summary="Get Order Receipt",
    response_model=CustomerOrderReceipt,
    responses={
        202: {"description": "Receipt generation in progress."},
        404: OrderNotFound,
    },
)
async def receipt(
    id: OrderID,
    auth_subject: auth.CustomerPortalUnionBillingRead,
    session: AsyncSession = Depends(get_db_session),
) -> Response | CustomerOrderReceipt:
    """Get a presigned URL to download an order's receipt PDF."""
    order = await customer_order_service.get_by_id(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    receipt = await customer_order_service.get_order_receipt(order)
    if receipt is None:
        return Response(status_code=202)

    return receipt


@router.get(
    "/{id}/payment-status",
    summary="Get Order Payment Status",
    response_model=CustomerOrderPaymentStatus,
    responses={404: OrderNotFound},
    tags=[APITag.private],
)
async def get_payment_status(
    id: OrderID,
    auth_subject: auth.CustomerPortalUnionBillingRead,
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
        429: {
            "description": "Manual retry limit exceeded.",
            "model": ManualRetryLimitExceeded.schema(),
        },
    },
    tags=[APITag.private],
)
async def confirm_retry_payment(
    id: OrderID,
    confirm_data: CustomerOrderConfirmPayment,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
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

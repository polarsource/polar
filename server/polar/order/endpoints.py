from textwrap import dedent
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query, Response

from polar.auth.permission import OrganizationPermission
from polar.authz.service import (
    assert_organization_permission,
    assert_resource_permission,
)
from polar.exceptions import ResourceNotFound
from polar.kit.csv import CSVStreamingResponse
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Order
from polar.openapi import APITag
from polar.organization.resolver import get_payload_organization
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .export import (
    OrderExportParams,
    generate_csv,
    get_filename,
)
from .schemas import Order as OrderSchema
from .schemas import (
    OrderCreate,
    OrderFinalize,
    OrderID,
    OrderInvoice,
    OrderListParams,
    OrderNotFound,
    OrderReceipt,
    OrderUpdate,
)
from .service import (
    MissingInvoiceBillingDetails,
    OffSessionChargesNotEnabled,
    OrderNotDraft,
    OrderNotEligibleForInvoice,
    OrganizationNotReadyForPayments,
    PaymentActionRequired,
    PaymentFailed,
)
from .service import order as order_service

router = APIRouter(prefix="/orders", tags=["orders", APITag.public])

GENERATE_INVOICE_MINTLIFY_CONTENT = dedent(
    """
    <Warning>
      Once the invoice is generated, it's permanent and cannot be modified.

      Make sure the billing details (name and address) are correct before generating the invoice. You can update them before generating the invoice by calling the [`PATCH /v1/orders/{id}`](/api-reference/orders/update-order) endpoint.
    </Warning>

    <Note>
      After successfully calling this endpoint, you get a `202` response, meaning the generation of the invoice has been scheduled. It usually only takes a few seconds before you can retrieve the invoice using the [`GET /v1/orders/{id}/invoice`](/api-reference/orders/get-order-invoice) endpoint.

      If you want a reliable notification when the invoice is ready, you can listen to the [`order.updated`](/api-reference/orderupdated) webhook and check the [`is_invoice_generated` field](/api-reference/orderupdated#schema-data-is-invoice-generated).
    </Note>
    """
).strip()

GET_INVOICE_MINTLIFY_CONTENT = dedent(
    """
    <Note>
      The invoice must be generated first before it can be retrieved. You should call the [`POST /v1/orders/{id}/invoice`](/api-reference/orders/generate-order-invoice) endpoint to generate the invoice.

      If the invoice is not generated, you will receive a `404` error.
    </Note>
    """
).strip()


@router.get(
    "/",
    summary="List Orders",
    response_model=ListResource[OrderSchema],
    tags=[APITag.mcp, APITag.cli],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    filters: Annotated[OrderListParams, Query()],
    auth_subject: auth.OrdersRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrderSchema]:
    """List orders."""
    results, count = await order_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        product_id=filters.product_id,
        product_billing_type=filters.product_billing_type,
        discount_id=filters.discount_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        checkout_id=filters.checkout_id,
        subscription_id=filters.subscription_id,
        status=filters.status,
        created_after=filters.created_after,
        created_before=filters.created_before,
        metadata=metadata,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrderSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/export", summary="Export Orders", response_class=CSVStreamingResponse)
async def export(
    filters: Annotated[OrderExportParams, Query()],
    auth_subject: auth.OrdersRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CSVStreamingResponse:
    """Export orders as a CSV file."""
    tzinfo = ZoneInfo(filters.timezone)
    return CSVStreamingResponse(
        generate_csv(
            session,
            auth_subject,
            organization_id=filters.organization_id,
            product_id=filters.product_id,
            status=filters.status,
            created_after=filters.created_after,
            created_before=filters.created_before,
            timezone=tzinfo,
            columns=filters.columns,
        ),
        get_filename(filters.created_after, filters.created_before, tzinfo),
    )


@router.get(
    "/{id}",
    summary="Get Order",
    response_model=OrderSchema,
    tags=[APITag.mcp, APITag.cli],
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


@router.post(
    "/",
    status_code=201,
    summary="Create Order",
    response_model=OrderSchema,
)
async def create(
    order_create: OrderCreate,
    auth_subject: auth.OrdersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """
    Create a draft order for an off-session charge against a saved payment
    method. The order is created with `status=draft` and no invoice number;
    call `POST /v1/orders/{id}/finalize` to attempt the charge.

    The organization must have the `off_session_charges_enabled` feature flag.
    """
    organization = await get_payload_organization(session, auth_subject, order_create)

    await assert_organization_permission(
        session, auth_subject, organization.id, OrganizationPermission.sales_manage
    )

    return await order_service.create_draft_order(session, organization, order_create)


@router.patch(
    "/{id}",
    summary="Update Order",
    response_model=OrderSchema,
    tags=[APITag.mcp, APITag.cli],
    responses={404: OrderNotFound},
)
async def update(
    order_update: OrderUpdate,
    authorized: auth.OrderSalesManage,
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update an order."""
    return await order_service.update(session, authorized.order, order_update)


@router.post(
    "/{id}/finalize",
    summary="Finalize Order",
    response_model=OrderSchema,
    responses={
        402: {
            "description": (
                "The charge failed, or requires customer authentication "
                "(e.g. a 3DS challenge) that can't be completed off-session."
            ),
            "model": PaymentFailed.schema() | PaymentActionRequired.schema(),
        },
        403: {
            "description": (
                "Off-session charges are not enabled for this organization, "
                "or its account can't currently accept payments."
            ),
            "model": OffSessionChargesNotEnabled.schema()
            | OrganizationNotReadyForPayments.schema(),
        },
        404: OrderNotFound,
        412: {
            "description": "The order is not in `draft` status.",
            "model": OrderNotDraft.schema(),
        },
    },
)
async def finalize(
    authorized: auth.OrderSalesManage,
    finalize_payload: OrderFinalize = OrderFinalize(),
    session: AsyncSession = Depends(get_db_session),
) -> Order:
    """
    Finalize a draft order and synchronously attempt an off-session charge.

    On success, the order transitions to `paid` and benefit grants fire
    before the response returns. On failure (decline, missing payment method,
    SCA challenge), the order stays in `draft` and a 4xx error is returned.

    The request fails with 412 if the order is not in `draft` status.
    """
    return await order_service.finalize_order(
        session,
        authorized.order,
        payment_method_id=finalize_payload.payment_method_id,
    )


@router.post(
    "/{id}/invoice",
    status_code=202,
    summary="Generate Order Invoice",
    tags=[APITag.mcp, APITag.cli],
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
    auth_subject: auth.OrdersRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Trigger generation of an order's invoice."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    await assert_resource_permission(
        session, auth_subject, order, OrganizationPermission.sales_manage
    )

    await order_service.trigger_invoice_generation(session, order)


@router.get(
    "/{id}/invoice",
    summary="Get Order Invoice",
    response_model=OrderInvoice,
    tags=[APITag.mcp, APITag.cli],
    responses={404: OrderNotFound},
    openapi_extra={"x-mint": {"content": GET_INVOICE_MINTLIFY_CONTENT}},
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


@router.get(
    "/{id}/receipt",
    summary="Get Order Receipt",
    response_model=OrderReceipt,
    tags=[APITag.mcp, APITag.cli],
    responses={
        202: {"description": "Receipt generation in progress."},
        404: OrderNotFound,
    },
)
async def receipt(
    id: OrderID,
    auth_subject: auth.OrdersRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Response | OrderReceipt:
    """Get a presigned URL to download an order's receipt PDF."""
    order = await order_service.get(session, auth_subject, id)

    if order is None:
        raise ResourceNotFound()

    receipt = await order_service.get_order_receipt(order)
    if receipt is None:
        return Response(status_code=202)

    return receipt

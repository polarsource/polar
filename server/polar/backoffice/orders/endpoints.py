import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import attr, classes, tag, text

from polar.invoice.service import invoice as invoice_service
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Customer, Order, Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.order import sorting
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.refund.schemas import RefundCreate
from polar.refund.service import refund as refund_service

from .. import formatters
from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .components import orders_datatable
from .forms import RefundForm

router = APIRouter()


# Description List Items
class StatusDescriptionListItem(description_list.DescriptionListItem[Order]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(self, request: Request, item: Order) -> Generator[None] | None:
        with order_status_badge(item.status):
            pass
        return None


class TaxRateItem(description_list.DescriptionListItem[Order]):
    def __init__(self, rate: float):
        super().__init__("Tax Rate")
        self.rate = rate

    def render(self, request: Request, item: Order) -> Generator[None] | None:
        text(f"{self.rate:.2f}%")
        return None


class TaxIDItem(description_list.DescriptionListAttrItem[Order]):
    def get_value(self, item: Order) -> Any:
        value = self.get_raw_value(item)
        if value is None:
            return None
        return formatters.tax_id(value)


class InvoicePDFItem(description_list.DescriptionListItem[Order]):
    def __init__(self, url: str | None):
        super().__init__("Invoice PDF")
        self.url = url

    def render(self, request: Request, item: Order) -> Generator[None] | None:
        with tag.div(classes="flex items-center gap-1"):
            if self.url is not None:
                with tag.a(href=self.url, classes="link flex flex-row gap-1"):
                    attr("target", "_blank")
                    attr("rel", "noopener noreferrer")
                    text("Download PDF")
                    with tag.div(classes="icon-external-link"):
                        pass
            else:
                with tag.span(classes="text-gray-500"):
                    text("Not generated")
        return None


# Table Columns
@contextlib.contextmanager
def order_status_badge(status: OrderStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == OrderStatus.paid:
            classes("badge-success")
        elif status == OrderStatus.pending:
            classes("badge-warning")
        elif status == OrderStatus.refunded:
            classes("badge-error")
        elif status == OrderStatus.partially_refunded:
            classes("badge-info")
        text(status.replace("_", " ").title())
    yield


@router.get("/", name="orders:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    status: Annotated[
        OrderStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    billing_reason: Annotated[
        OrderBillingReason | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = OrderRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Customer, Order.customer_id == Customer.id)
        .join(Product, Order.product_id == Product.id, isouter=True)
        .join(Organization, Customer.organization_id == Organization.id)
        .options(
            contains_eager(Order.customer).contains_eager(Customer.organization),
            contains_eager(Order.product),
        )
    )

    if query is not None:
        try:
            parsed_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    Order.id == parsed_uuid,
                    Order.customer_id == parsed_uuid,
                    Organization.id == parsed_uuid,
                )
            )
        except ValueError:
            statement = statement.where(
                or_(
                    Customer.email.ilike(f"%{query}%"),
                    Customer.name.ilike(f"%{query}%"),
                    Product.name.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                    Organization.name.ilike(f"%{query}%"),
                    Order.invoice_number.ilike(f"%{query}%"),
                )
            )

    if status is not None:
        statement = statement.where(Order.status == status)

    if billing_reason is not None:
        statement = statement.where(Order.billing_reason == billing_reason)

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Orders", str(request.url_for("orders:list"))),
        ],
        "orders:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Orders")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by customer, product, invoice number...",
                ):
                    pass
                with input.select(
                    [
                        ("All Statuses", ""),
                        ("Pending", OrderStatus.pending.value),
                        ("Paid", OrderStatus.paid.value),
                        ("Refunded", OrderStatus.refunded.value),
                        (
                            "Partially Refunded",
                            OrderStatus.partially_refunded.value,
                        ),
                    ],
                    status.value if status else "",
                    name="status",
                ):
                    pass
                with input.select(
                    [
                        ("All Billing Reasons", ""),
                        ("Purchase", OrderBillingReason.purchase.value),
                        (
                            "Subscription Create",
                            OrderBillingReason.subscription_create.value,
                        ),
                        (
                            "Subscription Cycle",
                            OrderBillingReason.subscription_cycle.value,
                        ),
                        (
                            "Subscription Update",
                            OrderBillingReason.subscription_update.value,
                        ),
                    ],
                    billing_reason.value if billing_reason else "",
                    name="billing_reason",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with orders_datatable(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="orders:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_by_id(
        id,
        options=(
            joinedload(Order.customer).joinedload(Customer.organization),
            joinedload(Order.product),
            joinedload(Order.discount),
            joinedload(Order.subscription),
        ),
    )

    if order is None:
        raise HTTPException(status_code=404)

    # Get invoice URL if it exists
    invoice_url: str | None = None
    if order.invoice_path is not None:
        try:
            invoice_url, _ = await invoice_service.get_order_invoice_url(order)
        except Exception:
            # If there's an error getting the URL, we'll show "Not generated"
            pass

    with layout(
        request,
        [
            (f"{order.id}", str(request.url)),
            ("Orders", str(request.url_for("orders:list"))),
        ],
        "orders:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.div(classes="flex items-center gap-2"):
                    with tag.h1(classes="text-4xl"):
                        text(f"Order {order.invoice_number}")
                    if order.refunds_blocked:
                        with tag.div(classes="badge badge-warning"):
                            text("Refunds Blocked")
                with tag.div(classes="flex gap-2"):
                    # Block/Unblock Refunds button
                    if order.refunds_blocked:
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for("orders:unblock_refunds", id=order.id)
                            ),
                        ):
                            with button(type="submit", outline=True):
                                text("Unblock Refunds")
                    else:
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for("orders:block_refunds", id=order.id)
                            ),
                        ):
                            with button(type="submit", outline=True):
                                text("Block Refunds")
                    # Add Refund button if order is paid, can be refunded, and refunds are not blocked
                    if (
                        order.paid
                        and not order.refunds_blocked
                        and (order.refunded_amount or 0) < (order.net_amount or 0)
                    ):
                        with button(
                            hx_get=str(request.url_for("orders:refund", id=order.id)),
                            hx_target="#modal",
                        ):
                            text("Refund")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Order Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Order Details")
                        with description_list.DescriptionList[Order](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created"
                            ),
                            description_list.DescriptionListAttrItem(
                                "invoice_number", "Invoice Number"
                            ),
                            StatusDescriptionListItem("Status"),
                            description_list.DescriptionListAttrItem(
                                "billing_reason", "Billing Reason"
                            ),
                            description_list.DescriptionListLinkItem[Order](
                                "subscription_id",
                                "Subscription",
                                href_getter=lambda r, i: str(
                                    r.url_for("subscriptions:get", id=i.subscription_id)
                                ),
                            ),
                            description_list.DescriptionListLinkItem[Order](
                                "stripe_invoice_id",
                                "Stripe Invoice",
                                href_getter=lambda _,
                                i: f"https://dashboard.stripe.com/invoices/{i.stripe_invoice_id}",
                                external=True,
                            ),
                            InvoicePDFItem(invoice_url),
                        ).render(request, order):
                            pass

                # Customer Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer")
                        with description_list.DescriptionList[Order](
                            description_list.DescriptionListAttrItem(
                                "customer.id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.email", "Email", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.name", "Name"
                            ),
                        ).render(request, order):
                            pass

                # Product Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Product")
                        with description_list.DescriptionList[Order](
                            description_list.DescriptionListAttrItem(
                                "product.id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "product.name", "Name"
                            ),
                            description_list.DescriptionListLinkItem[Order](
                                "organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.organization.id,
                                    )
                                ),
                            ),
                        ).render(request, order):
                            pass

            # Additional sections below the main grid
            with tag.div(classes="flex flex-col gap-4 mt-6"):
                # Invoice section
                if order.items:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Invoice")

                            # Billing Information (above table, left-aligned)
                            if order.billing_name or order.billing_address:
                                with tag.div(classes="text-sm mb-4 mt-4"):
                                    if order.billing_name:
                                        with tag.div():
                                            text(order.billing_name)
                                    if order.billing_address:
                                        if order.billing_address.line1:
                                            with tag.div():
                                                text(order.billing_address.line1)
                                        if order.billing_address.line2:
                                            with tag.div():
                                                text(order.billing_address.line2)
                                        with tag.div():
                                            address_parts = []
                                            if order.billing_address.city:
                                                address_parts.append(
                                                    order.billing_address.city
                                                )
                                            if order.billing_address.state:
                                                address_parts.append(
                                                    order.billing_address.state
                                                )
                                            if order.billing_address.postal_code:
                                                address_parts.append(
                                                    order.billing_address.postal_code
                                                )
                                            if address_parts:
                                                text(", ".join(address_parts))
                                        if order.billing_address.country:
                                            with tag.div():
                                                text(order.billing_address.country)

                            with tag.div(classes="overflow-x-auto"):
                                with tag.table(classes="table w-full"):
                                    with tag.thead():
                                        with tag.tr():
                                            with tag.th():
                                                text("Description")
                                            with tag.th(classes="text-right"):
                                                text("Quantity")
                                            with tag.th(classes="text-right"):
                                                text("Unit Price")
                                            with tag.th(classes="text-right"):
                                                text("Amount")
                                    with tag.tbody():
                                        for item in order.items:
                                            with tag.tr():
                                                with tag.td():
                                                    text(item.label)
                                                with tag.td(classes="text-right"):
                                                    text("1")
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.amount, order.currency
                                                        )
                                                    )
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.amount, order.currency
                                                        )
                                                    )

                                        # Financial summary rows
                                        with tag.tr(classes="border-t-2"):
                                            with tag.td(
                                                colspan="3",
                                                classes="text-right font-semibold",
                                            ):
                                                text("Subtotal")
                                            with tag.td(
                                                classes="text-right font-semibold"
                                            ):
                                                text(
                                                    formatters.currency(
                                                        order.subtotal_amount,
                                                        order.currency,
                                                    )
                                                )

                                        if order.discount_amount > 0:
                                            with tag.tr():
                                                with tag.td(
                                                    colspan="3", classes="text-right"
                                                ):
                                                    text("Discount")
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        f"-{
                                                            formatters.currency(
                                                                order.discount_amount,
                                                                order.currency,
                                                            )
                                                        }"
                                                    )

                                        if order.tax_amount > 0:
                                            with tag.tr():
                                                with tag.td(
                                                    colspan="3", classes="text-right"
                                                ):
                                                    # Build tax label with additional information
                                                    tax_label_parts = ["Tax"]

                                                    # Add tax rate if available
                                                    if (
                                                        order.tax_rate
                                                        and order.tax_rate.get(
                                                            "basis_points"
                                                        )
                                                    ):
                                                        basis_points = order.tax_rate[
                                                            "basis_points"
                                                        ]
                                                        if basis_points is not None:
                                                            rate_percentage = (
                                                                basis_points / 100
                                                            )
                                                            tax_label_parts.append(
                                                                f"({rate_percentage:.2f}%)"
                                                            )

                                                    # Add tax ID if available
                                                    if order.tax_id:
                                                        formatted_tax_id = (
                                                            formatters.tax_id(
                                                                order.tax_id
                                                            )
                                                        )
                                                        tax_label_parts.append(
                                                            f"• {formatted_tax_id}"
                                                        )

                                                    # Add taxability reason if available
                                                    if order.taxability_reason:
                                                        tax_label_parts.append(
                                                            f"• {order.taxability_reason}"
                                                        )

                                                    text(" ".join(tax_label_parts))
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            order.tax_amount,
                                                            order.currency,
                                                        )
                                                    )

                                        with tag.tr(classes="border-t-2"):
                                            with tag.td(
                                                colspan="3",
                                                classes="text-right font-bold",
                                            ):
                                                text("Total")
                                            with tag.td(classes="text-right font-bold"):
                                                text(
                                                    formatters.currency(
                                                        order.total_amount,
                                                        order.currency,
                                                    )
                                                )

                                        if order.applied_balance_amount != 0:
                                            with tag.tr():
                                                with tag.td(
                                                    colspan="3", classes="text-right"
                                                ):
                                                    text("Applied balance")
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            order.applied_balance_amount,
                                                            order.currency,
                                                        )
                                                    )

                                        if order.due_amount != order.total_amount:
                                            with tag.tr():
                                                with tag.td(
                                                    colspan="3",
                                                    classes="text-right font-bold",
                                                ):
                                                    text("To be paid")
                                                with tag.td(
                                                    classes="text-right font-bold"
                                                ):
                                                    text(
                                                        formatters.currency(
                                                            order.due_amount,
                                                            order.currency,
                                                        )
                                                    )

                                        if (
                                            order.refunded_amount
                                            and order.refunded_amount > 0
                                        ):
                                            with tag.tr():
                                                with tag.td(
                                                    colspan="3",
                                                    classes="text-right text-error",
                                                ):
                                                    text("Refunded Amount")
                                                with tag.td(
                                                    classes="text-right text-error"
                                                ):
                                                    text(
                                                        f"-{
                                                            formatters.currency(
                                                                order.refunded_amount,
                                                                order.currency,
                                                            )
                                                        }"
                                                    )


@router.api_route("/{id}/refund", name="orders:refund", methods=["GET", "POST"])
async def refund(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_by_id(
        id,
        options=order_repository.get_eager_options(),
    )

    if order is None:
        raise HTTPException(status_code=404)

    # Check if order can be refunded
    if not order.paid:
        await add_toast(request, "This order has not been paid yet.", "error")
        return

    if order.refunds_blocked:
        await add_toast(request, "Refunds are blocked for this order.", "error")
        return

    if (order.refunded_amount or 0) >= (order.net_amount or 0):
        await add_toast(request, "This order has already been fully refunded.", "error")
        return

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = RefundForm.model_validate_form(data)

            refund_create = RefundCreate(
                order_id=order.id,
                reason=form.reason,
                amount=int(form.amount * 100),
                comment=form.comment,
                revoke_benefits=form.revoke_benefits,
            )
            await refund_service.create(session, order, refund_create)
            await add_toast(request, "Refund created successfully.", "success")
            return HXRedirectResponse(
                request, str(request.url_for("orders:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e
        except Exception as e:
            await add_toast(request, f"Failed to create refund: {e}", "error")
            validation_error = None

    # Calculate max refundable amount
    max_refundable = (order.net_amount or 0) - (order.refunded_amount or 0)

    # Format amount for display
    from babel.numbers import format_currency

    max_refundable_display = format_currency(
        max_refundable / 100,
        order.currency.upper() if order.currency else "USD",
        locale="en_US",
    )

    with modal("Refund order", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text(f"Maximum refundable amount: {max_refundable_display}")
            with RefundForm.render(
                hx_post=str(request.url_for("orders:refund", id=id)),
                hx_target="#modal",
                classes="flex flex-col",
                validation_error=validation_error,
            ):
                with tag.div(classes="modal-action"):
                    with tag.form(method="dialog"):
                        with button(ghost=True):
                            text("Cancel")
                    with button(type="submit", variant="primary"):
                        text("Submit")


@router.post("/{id}/block-refunds", name="orders:block_refunds")
async def block_refunds(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_by_id(id)

    if order is None:
        raise HTTPException(status_code=404)

    if order.refunds_blocked:
        await add_toast(request, "Refunds are already blocked for this order.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("orders:get", id=id)), 303
        )

    await order_service.set_refunds_blocked(session, order, blocked=True)
    await add_toast(request, "Refunds have been blocked for this order.", "success")
    return HXRedirectResponse(request, str(request.url_for("orders:get", id=id)), 303)


@router.post("/{id}/unblock-refunds", name="orders:unblock_refunds")
async def unblock_refunds(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_by_id(id)

    if order is None:
        raise HTTPException(status_code=404)

    if not order.refunds_blocked:
        await add_toast(request, "Refunds are not blocked for this order.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("orders:get", id=id)), 303
        )

    await order_service.set_refunds_blocked(session, order, blocked=False)
    await add_toast(request, "Refunds have been unblocked for this order.", "success")
    return HXRedirectResponse(request, str(request.url_for("orders:get", id=id)), 303)

import builtins
import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Customer, Order, Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.order import sorting
from polar.order.repository import OrderRepository
from polar.order.sorting import OrderSortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import button, datatable, description_list, input
from ..layout import layout

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


# Table Columns
class StatusColumn(datatable.DatatableSortingColumn[Order, OrderSortProperty]):
    def __init__(self, label: str) -> None:
        super().__init__(label, sorting=OrderSortProperty.status)

    def render(self, request: Request, item: Order) -> Generator[None] | None:
        with order_status_badge(item.status):
            pass
        return None


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
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = OrderRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Customer, Order.customer_id == Customer.id)
        .join(Product, Order.product_id == Product.id)
        .join(Organization, Product.organization_id == Organization.id)
        .options(
            contains_eager(Order.customer),
            contains_eager(Order.product).contains_eager(Product.organization),
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

            with datatable.Datatable[Order, OrderSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", clipboard=True, href_route_name="orders:get"
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at", "Created", sorting=OrderSortProperty.created_at
                ),
                StatusColumn("Status"),
                datatable.DatatableAttrColumn(
                    "customer.email", "Customer", sorting=OrderSortProperty.customer
                ),
                datatable.DatatableAttrColumn(
                    "invoice_number",
                    "Invoice",
                    sorting=OrderSortProperty.invoice_number,
                ),
                datatable.DatatableCurrencyColumn(
                    "net_amount", "Net Amount", sorting=OrderSortProperty.net_amount
                ),
                datatable.DatatableAttrColumn("billing_reason", "Billing Reason"),
            ).render(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="orders:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_by_id(
        id,
        options=(
            joinedload(Order.customer),
            joinedload(Order.product).joinedload(Product.organization),
            joinedload(Order.discount),
            joinedload(Order.subscription),
        ),
    )

    if order is None:
        raise HTTPException(status_code=404)

    # Calculate amounts
    net_amount = order.subtotal_amount - order.discount_amount
    total_amount = net_amount + order.tax_amount
    refundable_amount = total_amount - order.refunded_amount - order.refunded_tax_amount

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
                with tag.h1(classes="text-4xl"):
                    text(f"Order {order.invoice_number}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Order Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Order Details")
                        with description_list.DescriptionList(
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
                            description_list.DescriptionListLinkItem(
                                "subscription_id",
                                "Subscription",
                                href_getter=lambda r, i: str(
                                    r.url_for("subscriptions:get", id=i.subscription_id)
                                ),
                            ),
                            description_list.DescriptionListLinkItem(
                                "stripe_invoice_id",
                                "Stripe Invoice",
                                href_getter=lambda _,
                                i: f"https://dashboard.stripe.com/invoices/{i.stripe_invoice_id}",
                                external=True,
                            ),
                        ).render(request, order):
                            pass

                # Financial Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Financial Details")
                        with description_list.DescriptionList[Order](
                            description_list.DescriptionListCurrencyItem(
                                "subtotal_amount", "Subtotal"
                            ),
                            description_list.DescriptionListCurrencyItem(
                                "discount_amount", "Discount"
                            ),
                            description_list.DescriptionListCurrencyItem(
                                "tax_amount", "Tax"
                            ),
                            description_list.DescriptionListCurrencyItem(
                                "total_amount", "Total"
                            ),
                            description_list.DescriptionListCurrencyItem(
                                "refunded_amount", "Refunded Amount"
                            ),
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
                            description_list.DescriptionListLinkItem(
                                "product.organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.product.organization_id,
                                    )
                                ),
                            ),
                        ).render(request, order):
                            pass

            # Additional sections below the main grid
            with tag.div(classes="flex flex-col gap-4 mt-6"):
                # Billing Information
                if order.billing_name or order.billing_address:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Billing Information")
                            billing_items: builtins.list[
                                description_list.DescriptionListItem[Order]
                            ] = []
                            if order.billing_name:
                                billing_items.append(
                                    description_list.DescriptionListAttrItem(
                                        "billing_name", "Name"
                                    )
                                )
                            if order.billing_address:
                                billing_items.extend(
                                    [
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.line1", "Address Line 1"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.line2", "Address Line 2"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.city", "City"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.state", "State"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.postal_code", "Postal Code"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "billing_address.country", "Country"
                                        ),
                                    ]
                                )

                            with description_list.DescriptionList(
                                *billing_items
                            ).render(request, order):
                                pass

                # Tax Information
                if order.tax_id or order.tax_rate or order.taxability_reason:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Tax Information")
                            tax_items: builtins.list[
                                description_list.DescriptionListItem[Order]
                            ] = []
                            if order.taxability_reason:
                                tax_items.append(
                                    description_list.DescriptionListAttrItem(
                                        "taxability_reason", "Taxability Reason"
                                    )
                                )
                            if order.tax_id:
                                tax_items.extend(
                                    [
                                        description_list.DescriptionListAttrItem(
                                            "tax_id.1", "Tax ID Type"
                                        ),
                                        description_list.DescriptionListAttrItem(
                                            "tax_id.0", "Tax ID Number"
                                        ),
                                    ]
                                )
                            if order.tax_rate and order.tax_rate.get("basis_points"):
                                basis_points = order.tax_rate["basis_points"]
                                if basis_points is not None:
                                    rate_percentage = basis_points / 100
                                    tax_items.append(TaxRateItem(rate_percentage))

                            with description_list.DescriptionList(*tax_items).render(
                                request, order
                            ):
                                pass

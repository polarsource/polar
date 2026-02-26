import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import attr, classes, tag, text

from polar.enums import PaymentProcessor
from polar.kit.sorting import Sorting
from polar.models import Order, Payment
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.order.sorting import OrderSortProperty
from polar.payment.sorting import PaymentSortProperty

from ..components import datatable


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
        elif status == OrderStatus.void:
            classes("badge-error")
        text(status.replace("_", " ").title())
    yield


@contextlib.contextmanager
def payment_status_badge(status: PaymentStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == PaymentStatus.succeeded:
            classes("badge-success")
        elif status == PaymentStatus.pending:
            classes("badge-warning")
        elif status == PaymentStatus.failed:
            classes("badge-error")
        text(status.replace("_", " ").title())
    yield


class PaymentStatusColumn(
    datatable.DatatableSortingColumn[Payment, PaymentSortProperty]
):
    def __init__(self, label: str) -> None:
        super().__init__(label, sorting=PaymentSortProperty.status)

    def render(self, request: Request, item: Payment) -> Generator[None] | None:
        with payment_status_badge(item.status):
            pass
        return None


class PaymentProcessorIdColumn(
    datatable.DatatableAttrColumn[Payment, PaymentSortProperty]
):
    def __init__(self) -> None:
        super().__init__("processor_id", "Processor ID", clipboard=True)

    def render(self, request: Request, item: Payment) -> Generator[None] | None:
        if item.processor == PaymentProcessor.stripe:
            with tag.a(
                href=f"https://dashboard.stripe.com/payments/{item.processor_id}",
                classes="link flex flex-row gap-1 items-center",
            ):
                attr("target", "_blank")
                attr("rel", "noopener noreferrer")
                text(item.processor_id)
                with tag.div(classes="icon-external-link"):
                    pass
        else:
            text(item.processor_id)
        return None


@contextlib.contextmanager
def orders_datatable(
    request: Request,
    items: Sequence[Order],
    sorting: list[Sorting[OrderSortProperty]] | None = None,
) -> Generator[None]:
    d = datatable.Datatable[Order, OrderSortProperty](
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
    )

    with d.render(request, items, sorting=sorting):
        pass
    yield


@contextlib.contextmanager
def payments_datatable(
    request: Request,
    items: Sequence[Payment],
) -> Generator[None]:
    d = datatable.Datatable[Payment, PaymentSortProperty](
        datatable.DatatableAttrColumn("id", "ID", clipboard=True),
        datatable.DatatableDateTimeColumn(
            "created_at", "Created", sorting=PaymentSortProperty.created_at
        ),
        PaymentStatusColumn("Status"),
        datatable.DatatableAttrColumn("processor", "Processor"),
        PaymentProcessorIdColumn(),
        datatable.DatatableCurrencyColumn(
            "amount", "Amount", sorting=PaymentSortProperty.amount
        ),
        datatable.DatatableAttrColumn(
            "method", "Method", sorting=PaymentSortProperty.method
        ),
    )

    with d.render(request, items):
        pass
    yield

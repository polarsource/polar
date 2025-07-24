import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import classes, tag, text

from polar.kit.sorting import Sorting
from polar.models import Order
from polar.models.order import OrderStatus
from polar.order.sorting import OrderSortProperty

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
        text(status.replace("_", " ").title())
    yield


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

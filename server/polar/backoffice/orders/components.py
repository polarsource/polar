import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request

from polar.backoffice.document import get_document
from polar.kit.sorting import Sorting
from polar.models import Order
from polar.models.order import OrderStatus
from polar.order.sorting import OrderSortProperty

from ..components import datatable
class StatusColumn(datatable.DatatableSortingColumn[Order, OrderSortProperty]):
    def __init__(self, label: str) -> None:
        super().__init__(label, sorting=OrderSortProperty.status)

    def render(self, request: Request, item: Order) -> Generator[None] | None:

        
        doc = get_document(request)
            with order_status_badge(item.status):
            pass
        return None


@contextlib.contextmanager
def order_status_badge(status: OrderStatus) -> Generator[None]:
    
    doc = get_document(request)
    with doc.div(classes="badge"):
        if status == OrderStatus.paid:
            doc.attr("class", "badge-success")
        elif status == OrderStatus.pending:
            doc.attr("class", "badge-warning")
        elif status == OrderStatus.refunded:
            doc.attr("class", "badge-error")
        elif status == OrderStatus.partially_refunded:
            doc.attr("class", "badge-info")
        doc.text(status.replace("_", " ").title())
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

import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import classes, tag, text

from polar.checkout_link.sorting import CheckoutLinkSortProperty
from polar.kit.sorting import Sorting
from polar.models import CheckoutLink

from ..components import datatable


class StatusColumn(
    datatable.DatatableSortingColumn[CheckoutLink, CheckoutLinkSortProperty]
):
    def __init__(self, label: str) -> None:
        super().__init__(label, sorting=CheckoutLinkSortProperty.created_at)

    def render(self, request: Request, item: CheckoutLink) -> Generator[None] | None:
        with checkout_link_status_badge(item.deleted_at is not None):
            pass
        return None


@contextlib.contextmanager
def checkout_link_status_badge(is_deleted: bool) -> Generator[None]:
    with tag.div(classes="badge"):
        if is_deleted:
            classes("badge-error")
            text("Deleted")
        else:
            classes("badge-success")
            text("Active")
    yield


@contextlib.contextmanager
def checkout_links_datatable(
    request: Request,
    items: Sequence[CheckoutLink],
    sorting: list[Sorting[CheckoutLinkSortProperty]] | None = None,
) -> Generator[None]:
    d = datatable.Datatable[CheckoutLink, CheckoutLinkSortProperty](
        datatable.DatatableAttrColumn(
            "id", "ID", clipboard=True, href_route_name="checkout_links:get"
        ),
        datatable.DatatableDateTimeColumn(
            "created_at", "Created", sorting=CheckoutLinkSortProperty.created_at
        ),
        StatusColumn("Status"),
        datatable.DatatableAttrColumn(
            "label", "Label", sorting=CheckoutLinkSortProperty.label
        ),
        datatable.DatatableAttrColumn(
            "organization.name",
            "Organization",
            sorting=CheckoutLinkSortProperty.organization,
        ),
        datatable.DatatableAttrColumn("client_secret", "Client Secret", clipboard=True),
    )

    with d.render(request, items, sorting=sorting):
        pass
    yield

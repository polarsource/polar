import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import classes, tag, text

from polar.customer.sorting import CustomerSortProperty
from polar.kit.sorting import Sorting
from polar.models import Customer

from ..components import datatable


class CustomerIDColumn(datatable.DatatableAttrColumn[Customer, CustomerSortProperty]):
    def __init__(self) -> None:
        super().__init__("id", "ID", clipboard=True)
        self.href_getter = lambda r, i: str(r.url_for("customers:get", id=i.id))


class OrganizationColumn(datatable.DatatableAttrColumn[Customer, CustomerSortProperty]):
    def __init__(self) -> None:
        super().__init__("organization.name", "Organization")
        self.href_getter = lambda r, i: str(
            r.url_for("organizations:get", id=i.organization_id)
        )


@contextlib.contextmanager
def email_verified_badge(verified: bool) -> Generator[None]:
    with tag.div(classes="badge"):
        if verified:
            classes("badge-success")
            text("Verified")
        else:
            classes("badge-neutral")
            text("Not Verified")
    yield


@contextlib.contextmanager
def customers_datatable(
    request: Request,
    items: Sequence[Customer],
    sorting: list[Sorting[CustomerSortProperty]] | None = None,
) -> Generator[None]:
    d = datatable.Datatable[Customer, CustomerSortProperty](
        CustomerIDColumn(),
        datatable.DatatableAttrColumn("email", "Email", clipboard=True),
        datatable.DatatableAttrColumn("name", "Name"),
        OrganizationColumn(),
        datatable.DatatableDateTimeColumn("created_at", "Created"),
    )

    with d.render(request, items, sorting=sorting):
        pass
    yield

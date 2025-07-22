import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager
from tagflow import classes, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Customer, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession, get_db_session
from polar.subscription import sorting
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.sorting import SubscriptionSortProperty

from ..components import datatable, input
from ..layout import layout

router = APIRouter()


@contextlib.contextmanager
def subscription_status_badge(subscription: Subscription) -> Generator[None]:
    status = subscription.status
    with tag.div(classes="badge"):
        if status == SubscriptionStatus.active:
            if subscription.cancel_at_period_end:
                classes("badge-warning")
            else:
                classes("badge-success")
        elif status == SubscriptionStatus.trialing:
            classes("badge-info")
        elif status in {SubscriptionStatus.unpaid, SubscriptionStatus.past_due}:
            classes("badge-error")
        else:  # canceled, incomplete, incomplete_expired
            classes("badge-neutral")
        text(status.value.replace("_", " ").title())
    yield


class StatusColumn(
    datatable.DatatableSortingColumn[Subscription, SubscriptionSortProperty]
):
    def render(self, request: Request, item: Subscription) -> Generator[None] | None:
        with subscription_status_badge(item):
            pass
        return None


class OrganizationColumn(
    datatable.DatatableAttrColumn[Subscription, SubscriptionSortProperty]
):
    def __init__(self) -> None:
        super().__init__("product.organization.name", "Organization")
        self.href_getter = lambda r, i: str(
            r.url_for("organizations:get", id=i.product.organization_id)
        )


@router.get("/", name="subscriptions:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    status: Annotated[
        SubscriptionStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = SubscriptionRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Customer, Subscription.customer_id == Customer.id, isouter=True)
        .join(Product, Subscription.product_id == Product.id, isouter=True)
        .options(
            contains_eager(Subscription.customer),
            contains_eager(Subscription.product).joinedload(Product.organization),
        )
    )

    if query is not None:
        try:
            parsed_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(Subscription.id == parsed_uuid, Organization.id == parsed_uuid)
            )
        except ValueError:
            statement = statement.where(
                or_(
                    Customer.email.ilike(f"%{query}%"),
                    Customer.name.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                    Organization.name.ilike(f"%{query}%"),
                )
            )

    if status is not None:
        statement = statement.where(Subscription.status == status)

    statement = repository.apply_sorting(statement, sorting)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Subscriptions", str(request.url_for("subscriptions:list"))),
        ],
        "subscriptions:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Subscriptions")
            with tag.div(classes="w-full flex flex-row gap-2"):
                with tag.form(method="GET"):
                    with input.search(
                        "query",
                        query,
                        placeholder="Search by ID, organization or customer",
                    ):
                        pass
                with tag.form(
                    method="GET",
                    _="""
                    on change from <select/> in me
                        call me.submit()
                    end
                    """,
                ):
                    with input.select(
                        [
                            (status.value.replace("_", " ").title(), status.value)
                            for status in SubscriptionStatus
                        ],
                        status,
                        name="status",
                        placeholder="Status",
                    ):
                        pass
            with datatable.Datatable[Subscription, SubscriptionSortProperty](
                datatable.DatatableAttrColumn("id", "ID", clipboard=True),
                datatable.DatatableDateTimeColumn(
                    "started_at",
                    "Started At",
                    sorting=SubscriptionSortProperty.started_at,
                ),
                StatusColumn("Status", sorting=SubscriptionSortProperty.status),
                datatable.DatatableAttrColumn(
                    "customer.email",
                    "Customer",
                    sorting=SubscriptionSortProperty.customer,
                    clipboard=True,
                ),
                OrganizationColumn(),
                datatable.DatatableAttrColumn(
                    "product.name",
                    "Product",
                    sorting=SubscriptionSortProperty.product,
                ),
                datatable.DatatableDateTimeColumn(
                    "current_period_end",
                    "Current Period End",
                    sorting=SubscriptionSortProperty.current_period_end,
                ),
            ).render(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass

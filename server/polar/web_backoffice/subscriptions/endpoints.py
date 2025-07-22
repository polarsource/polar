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
from polar.models import Customer, Order, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.sorting import OrderSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.subscription import sorting
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.sorting import SubscriptionSortProperty

from ..components import datatable, description_list, input
from ..formatters import currency
from ..layout import layout

router = APIRouter()


# Description List Items
class SubscriptionAmountDescriptionListItem(
    description_list.DescriptionListAttrItem[Subscription]
):
    def get_value(self, item: Subscription) -> str | None:
        amount: int | None = getattr(item, self.attr)
        if amount is None:
            return None
        return currency(amount, item.currency)


class ProductNameDescriptionListItem(
    description_list.DescriptionListAttrItem[Subscription]
):
    def render(self, request: Request, item: Subscription) -> Generator[None] | None:
        value = self.get_value(item)
        with tag.div(classes="flex items-center gap-1"):
            if value is not None:
                text(value)
            else:
                text("—")
        return None


class OrganizationDescriptionListItem(
    description_list.DescriptionListAttrItem[Subscription]
):
    def render(self, request: Request, item: Subscription) -> Generator[None] | None:
        value = self.get_value(item)
        with tag.div(classes="flex items-center gap-1"):
            if value is not None:
                with tag.a(
                    href=str(
                        request.url_for(
                            "organizations:get", id=item.product.organization_id
                        )
                    ),
                    classes="link",
                ):
                    text(value)
            else:
                text("—")
        return None


class StatusDescriptionListItem(description_list.DescriptionListItem[Subscription]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(self, request: Request, item: Subscription) -> Generator[None] | None:
        with subscription_status_badge(item):
            pass
        return None


# Datatable Columns
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


class OrderAmountColumn(datatable.DatatableAttrColumn[Order, OrderSortProperty]):
    def __init__(self, label: str) -> None:
        super().__init__("total_amount", label)

    def get_value(self, item: Order) -> str | None:
        value: int | None = self.get_raw_value(item)
        if value is None:
            return None
        return currency(value, item.currency)


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
        .join(Customer, Subscription.customer_id == Customer.id)
        .join(Product, Subscription.product_id == Product.id)
        .join(Organization, Product.organization_id == Organization.id)
        .options(
            contains_eager(Subscription.customer),
            contains_eager(Subscription.product).contains_eager(Product.organization),
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
                datatable.DatatableAttrColumn(
                    "id", "ID", clipboard=True, href_route_name="subscriptions:get"
                ),
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


@router.get("/{id}", name="subscriptions:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(
        id,
        options=(
            joinedload(Subscription.customer),
            joinedload(Subscription.product).joinedload(Product.organization),
            joinedload(Subscription.discount),
        ),
    )

    if subscription is None:
        raise HTTPException(status_code=404)

    # Get associated orders
    order_repository = OrderRepository.from_session(session)
    orders_statement = (
        order_repository.get_base_statement()
        .where(Order.subscription_id == subscription.id)
        .order_by(Order.created_at.desc())
    )
    orders = await order_repository.get_all(orders_statement)

    with layout(
        request,
        [
            (f"{subscription.id}", str(request.url)),
            ("Subscriptions", str(request.url_for("subscriptions:list"))),
        ],
        "subscriptions:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(f"Subscription {subscription.id}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Subscription Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Subscription Details")
                        with description_list.DescriptionList[Subscription](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            StatusDescriptionListItem("Status"),
                            description_list.DescriptionListDateTimeItem(
                                "started_at", "Started At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "current_period_start", "Current Period Start"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "current_period_end", "Current Period End"
                            ),
                            description_list.DescriptionListAttrItem(
                                "recurring_interval", "Recurring Interval"
                            ),
                            SubscriptionAmountDescriptionListItem("amount", "Amount"),
                        ).render(request, subscription):
                            pass

                        # Cancellation details if applicable
                        if (
                            subscription.cancel_at_period_end
                            or subscription.canceled_at
                        ):
                            with tag.div(classes="mt-4"):
                                with tag.h3(classes="text-lg font-semibold"):
                                    text("Cancellation Details")
                                with description_list.DescriptionList[Subscription](
                                    description_list.DescriptionListAttrItem(
                                        "cancel_at_period_end", "Cancel at Period End"
                                    ),
                                    description_list.DescriptionListDateTimeItem(
                                        "canceled_at", "Canceled At"
                                    ),
                                    description_list.DescriptionListDateTimeItem(
                                        "ends_at", "Ends At"
                                    ),
                                    description_list.DescriptionListDateTimeItem(
                                        "ended_at", "Ended At"
                                    ),
                                ).render(request, subscription):
                                    pass

                # Product and Organization
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Product & Organization")
                        with description_list.DescriptionList[Subscription](
                            ProductNameDescriptionListItem("product.name", "Product"),
                            OrganizationDescriptionListItem(
                                "product.organization.name", "Organization"
                            ),
                        ).render(request, subscription):
                            pass

                # Customer Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer")
                        with description_list.DescriptionList[Subscription](
                            description_list.DescriptionListAttrItem(
                                "customer.id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.email", "Email", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.name", "Name"
                            ),
                        ).render(request, subscription):
                            pass

                # Discount if applicable
                if subscription.discount:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Discount")
                            with description_list.DescriptionList[Subscription](
                                description_list.DescriptionListAttrItem(
                                    "discount.name", "Name"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "discount.code", "Code"
                                ),
                            ).render(request, subscription):
                                pass

            # Orders table
            with tag.div(classes="flex flex-col gap-4"):
                with tag.h2(classes="text-2xl"):
                    text("Orders")
                with datatable.Datatable[Order, OrderSortProperty](
                    datatable.DatatableAttrColumn("id", "Order ID", clipboard=True),
                    datatable.DatatableDateTimeColumn("created_at", "Created At"),
                    OrderAmountColumn("Amount"),
                    datatable.DatatableAttrColumn("status", "Status"),
                ).render(request, orders):
                    pass

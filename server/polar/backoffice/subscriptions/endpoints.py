import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Customer, Order, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.subscription import sorting
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
from polar.subscription.sorting import SubscriptionSortProperty

from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..orders.components import orders_datatable
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .forms import CancelForm

router = APIRouter()


# Description List Items
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
    session: AsyncSession = Depends(get_db_read_session),
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
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by ID, organization or customer",
                ):
                    pass
                with input.select(
                    [
                        ("All Statuses", ""),
                        *[
                            (status.value.replace("_", " ").title(), status.value)
                            for status in SubscriptionStatus
                        ],
                    ],
                    status.value if status else "",
                    name="status",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")
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
    session: AsyncSession = Depends(get_db_read_session),
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
        .options(joinedload(Order.customer))
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
                if subscription.can_cancel():
                    with button(
                        hx_get=str(
                            request.url_for("subscriptions:cancel", id=subscription.id)
                        ),
                        hx_target="#modal",
                    ):
                        text("Cancel")
                if subscription.can_uncancel():
                    with button(
                        hx_get=str(
                            request.url_for(
                                "subscriptions:uncancel", id=subscription.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        text("Uncancel")

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
                            description_list.DescriptionListCurrencyItem(
                                "amount", "Amount"
                            ),
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
                            description_list.DescriptionListAttrItem(
                                "product.name", "Product"
                            ),
                            description_list.DescriptionListLinkItem[Subscription](
                                "product.organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.product.organization_id,
                                    )
                                ),
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
                with orders_datatable(request, orders):
                    pass


@router.api_route("/{id}/cancel", name="subscriptions:cancel", methods=["GET", "POST"])
async def cancel(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(id)

    if subscription is None:
        raise HTTPException(status_code=404)

    if not subscription.can_cancel():
        await add_toast(request, "This subscription is already canceled.", "error")
        return

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = CancelForm.model_validate_form(data)
            await subscription_service._perform_cancellation(
                session,
                subscription,
                customer_reason=form.customer_cancellation_reason,
                customer_comment=form.customer_cancellation_comment,
                immediately=form.revoke,
            )
            return HXRedirectResponse(
                request, str(request.url_for("subscriptions:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e

    with modal("Cancel subscription", open=True):
        with CancelForm.render(
            hx_post=str(request.url_for("subscriptions:cancel", id=id)),
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


@router.api_route(
    "/{id}/uncancel", name="subscriptions:uncancel", methods=["GET", "POST"]
)
async def uncancel(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(id)

    if subscription is None:
        raise HTTPException(status_code=404)

    if not subscription.can_uncancel():
        await add_toast(request, "This subscription cannot be uncanceled.", "error")
        return

    if request.method == "POST":
        await subscription_service.uncancel(session, subscription)
        return HXRedirectResponse(
            request, str(request.url_for("subscriptions:get", id=id)), 303
        )

    with modal("Uncancel subscription", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to uncancel this subscription? ")
                text(
                    "The billing cycle will be resumed, and the subscription will be active again."
                )
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="button",
                    variant="primary",
                    hx_post=str(request.url),
                    hx_target="#modal",
                ):
                    text("Submit")

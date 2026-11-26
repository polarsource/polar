import builtins
import contextlib
import itertools
import uuid
from collections import defaultdict
from collections.abc import Generator, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import contains_eager, joinedload, selectinload
from tagflow import classes, tag, text

from polar.backoffice.routing import BackofficeRouter
from polar.billing_interval.repository import BillingIntervalRepository
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import (
    BillingInterval,
    Customer,
    Meter,
    Order,
    Organization,
    Product,
    ProductPriceMeteredUnit,
    Reducer,
    ReducerBucket,
    Subscription,
    SubscriptionMeter,
)
from polar.models.billing_interval import UsagePolicy
from polar.models.reducer import ReducerKind
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.product.guard import is_metered_price
from polar.reducer.bucket_repository import (
    ReducerBucketRepository,
    get_customer_identities,
)
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import finalize_quantity, merge_summaries
from polar.reducer.types import UsageSummary
from polar.subscription import sorting
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from polar.subscription.sorting import SubscriptionSortProperty

from .. import formatters
from ..components import (
    alert,
    button,
    datatable,
    description_list,
    input,
    modal,
)
from ..layout import layout
from ..orders.components import orders_datatable
from ..responses import HXRedirectResponse
from ..search import organization_ilike
from ..toast import add_toast
from .forms import CancelForm, UpdateBillingPeriodEndForm, build_update_status_form

router = BackofficeRouter()

STATUS_TRANSITIONS: dict[SubscriptionStatus, set[SubscriptionStatus]] = {
    SubscriptionStatus.past_due: {SubscriptionStatus.active},
}


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
            r.url_for("organizations:detail", organization_id=i.product.organization_id)
        )


class SubscriptionMeterAmountColumn(
    datatable.DatatableCurrencyColumn[SubscriptionMeter, SubscriptionSortProperty]
):
    def __init__(self, currency: str) -> None:
        super().__init__("amount", "Amount")
        self.currency = currency

    def get_currency(self, item: SubscriptionMeter) -> str:
        return self.currency


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
        elif status == SubscriptionStatus.trial_ended:
            classes("badge-warning")
        else:  # canceled, incomplete, incomplete_expired
            classes("badge-neutral")
        text(status.value.replace("_", " ").title())
    yield


@dataclass(frozen=True)
class BucketRow:
    bucket_start: datetime
    bucket_end: datetime
    generation: int
    units: Decimal
    credited_units: Decimal
    status: str
    order_id: UUID | None


@dataclass(frozen=True)
class StatusTotal:
    status: str
    order_id: UUID | None
    units: Decimal
    credited_units: Decimal
    amount: int


@dataclass(frozen=True)
class IntervalUsage:
    interval: BillingInterval
    rows: Sequence[BucketRow]
    totals: Sequence[StatusTotal]


STATUS_ORDER = {"Billed": 0, "Unbilled": 1, "Open": 2}
STATUS_BADGES = {
    "Billed": "badge-success",
    "Unbilled": "badge-warning",
    "Open": "badge-info",
}

type BucketPair = tuple[builtins.list[ReducerBucket], builtins.list[ReducerBucket]]


def get_bucket_status(bucket: ReducerBucket) -> tuple[str, UUID | None]:
    if bucket.sealed_at is None:
        return "Open", None
    if bucket.order_id is None:
        return "Unbilled", None
    return "Billed", bucket.order_id


def get_quantity(buckets: Sequence[ReducerBucket], reducer: Reducer | None) -> Decimal:
    if not buckets or reducer is None:
        return Decimal(0)
    return finalize_quantity(
        merge_summaries(
            [
                UsageSummary(bucket.count, bucket.sum, bucket.min, bucket.max)
                for bucket in buckets
            ]
        ),
        reducer.aggregation.func,
    )


def get_interval_usage(
    interval: BillingInterval,
    usage_buckets: Sequence[ReducerBucket],
    credit_buckets: Sequence[ReducerBucket],
    usage_reducer: Reducer | None,
    credit_reducer: Reducer | None,
) -> IntervalUsage:
    rows: defaultdict[tuple[datetime, datetime, int, str, UUID | None], BucketPair] = (
        defaultdict(lambda: ([], []))
    )
    totals: defaultdict[tuple[str, UUID | None], BucketPair] = defaultdict(
        lambda: ([], [])
    )
    for index, buckets in enumerate((usage_buckets, credit_buckets)):
        for bucket in buckets:
            if bucket.count == 0:
                continue
            status = get_bucket_status(bucket)
            rows[(bucket.bucket_start, bucket.bucket_end, bucket.generation, *status)][
                index
            ].append(bucket)
            totals[status][index].append(bucket)

    price = interval.product_price
    charged = interval.usage_policy == UsagePolicy.charge

    def get_total(status: str, order_id: UUID | None, pair: BucketPair) -> StatusTotal:
        units = get_quantity(pair[0], usage_reducer)
        credited_units = get_quantity(pair[1], credit_reducer)
        amount = 0
        if charged and is_metered_price(price):
            amount, _ = price.get_amount_and_label(float(units), credited_units)
        return StatusTotal(status, order_id, units, credited_units, amount)

    return IntervalUsage(
        interval,
        [
            BucketRow(
                start,
                end,
                generation,
                get_quantity(usage, usage_reducer),
                get_quantity(credit, credit_reducer),
                status,
                order_id,
            )
            for (start, end, generation, status, order_id), (usage, credit) in sorted(
                rows.items(), key=lambda item: item[0][:3]
            )
        ],
        [
            get_total(status, order_id, pair)
            for (status, order_id), pair in sorted(
                totals.items(),
                key=lambda item: (STATUS_ORDER[item[0][0]], str(item[0][1])),
            )
        ],
    )


async def get_billing_intervals(
    session: AsyncSession, subscription: Subscription
) -> dict[Meter, Sequence[IntervalUsage]]:
    intervals = await BillingIntervalRepository.from_session(
        session
    ).get_by_subscription_with_prices(subscription.id)
    reducer_repository = ReducerRepository.from_session(session)
    bucket_repository = ReducerBucketRepository.from_session(session)
    identities = get_customer_identities(subscription.customer)

    async def get_buckets(
        reducer: Reducer | None, interval: BillingInterval
    ) -> Sequence[ReducerBucket]:
        if reducer is None:
            return []
        return await bucket_repository.get_all_by_identities_starting_within(
            reducer, identities, interval.period_start, interval.period_end
        )

    result: dict[Meter, Sequence[IntervalUsage]] = {}
    for meter, meter_intervals in itertools.groupby(
        intervals, key=lambda interval: interval.meter
    ):
        usage_reducer = await reducer_repository.get_by_meter_and_kind(
            meter.id, ReducerKind.usage
        )
        credit_reducer = await reducer_repository.get_by_meter_and_kind(
            meter.id, ReducerKind.credit
        )
        result[meter] = [
            get_interval_usage(
                interval,
                await get_buckets(usage_reducer, interval),
                await get_buckets(credit_reducer, interval),
                usage_reducer,
                credit_reducer,
            )
            for interval in meter_intervals
        ]
    return result


@contextlib.contextmanager
def interval_usage_card(
    request: Request,
    usage: IntervalUsage,
    orders: Mapping[UUID, Order],
    currency: str,
) -> Generator[None]:
    interval = usage.interval
    price = interval.product_price
    charged = interval.usage_policy == UsagePolicy.charge
    with tag.div(classes="card card-border w-full shadow-sm"):
        with tag.div(classes="card-body gap-4"):
            with tag.div(classes="flex flex-wrap items-center justify-between gap-2"):
                with tag.div(classes="flex items-center gap-3"):
                    with tag.h4(classes="card-title"):
                        text(price.product.name)
                    with tag.span(classes="text-sm text-gray-500"):
                        if isinstance(price, ProductPriceMeteredUnit):
                            text(
                                formatters.currency(
                                    price.unit_amount,
                                    price.price_currency,
                                    decimal_quantization=False,
                                )
                                + " / unit"
                            )
                        else:
                            text(price.amount_type.replace("_", " "))
                    with tag.div(classes="badge badge-sm"):
                        classes("badge-success" if charged else "badge-neutral")
                        text(interval.usage_policy)
                with tag.div(classes="text-sm text-gray-500"):
                    text(
                        f"{formatters.datetime(interval.period_start)} → "
                        + (
                            formatters.datetime(interval.period_end)
                            if interval.period_end
                            else "ongoing"
                        )
                        + " UTC"
                    )

            if not usage.rows:
                with tag.p(classes="text-sm text-gray-500"):
                    text("No usage")
            else:
                with tag.div(
                    classes="stats stats-vertical lg:stats-horizontal border border-base-200"
                ):
                    for total in usage.totals:
                        with tag.div(classes="stat py-3"):
                            with tag.div(classes="stat-title flex items-center gap-2"):
                                with tag.span(classes="badge badge-sm"):
                                    classes(STATUS_BADGES[total.status])
                                    text(total.status)
                            with tag.div(classes="stat-value text-2xl"):
                                text(formatters.currency(total.amount, currency))
                            with tag.div(classes="stat-desc"):
                                description = f"{total.units} units"
                                if total.credited_units:
                                    description += f", {total.credited_units} credited"
                                if not charged:
                                    description += " · not charged"
                                text(description)
                            if total.order_id is not None:
                                order = orders.get(total.order_id)
                                with tag.a(
                                    href=str(
                                        request.url_for("orders:get", id=total.order_id)
                                    ),
                                    classes="stat-desc link",
                                ):
                                    text(f"Order {total.order_id}")
                                if order is not None:
                                    with tag.div(classes="stat-desc"):
                                        text(
                                            "Subtotal "
                                            + formatters.currency(
                                                order.subtotal_amount, order.currency
                                            )
                                        )

                with tag.div(
                    classes="overflow-x-auto rounded-box border border-base-200"
                ):
                    with tag.table(classes="table table-sm"):
                        with tag.thead():
                            with tag.tr():
                                for header in (
                                    "Window",
                                    "Generation",
                                    "Quantity",
                                    "Credits",
                                    "Status",
                                ):
                                    with tag.th():
                                        text(header)
                        with tag.tbody():
                            previous_window: tuple[datetime, datetime] | None = None
                            for row in usage.rows:
                                window = (row.bucket_start, row.bucket_end)
                                with tag.tr():
                                    with tag.td(classes="font-mono text-xs"):
                                        if window != previous_window:
                                            text(
                                                f"{row.bucket_start:%Y-%m-%d %H:%M:%S}"
                                                f" – {row.bucket_end:%H:%M:%S}"
                                            )
                                        else:
                                            with tag.span(classes="pl-4 text-gray-500"):
                                                text("↳ late")
                                    with tag.td():
                                        text(str(row.generation))
                                    with tag.td():
                                        text(str(row.units))
                                    with tag.td():
                                        text(str(row.credited_units))
                                    with tag.td():
                                        with tag.span(classes="badge badge-sm"):
                                            classes(STATUS_BADGES[row.status])
                                            text(row.status)
                                previous_window = window
    yield


@router.get("/", name="subscriptions:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: Annotated[str | None, BeforeValidator(empty_str_to_none), Query()] = None,
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
                or_(
                    Subscription.id == parsed_uuid,
                    Subscription.organization_id == parsed_uuid,
                )
            )
        except ValueError:
            ts_query_simple = func.websearch_to_tsquery("simple", query)
            ilike_term = f"%{query}%"
            statement = statement.where(
                or_(
                    Customer.search_vector.op("@@")(ts_query_simple),
                    organization_ilike(ilike_term),
                )
            )

    if status is not None:
        statement = statement.where(Subscription.status == status)

    statement = repository.apply_sorting(statement, sorting)
    items, has_more = await repository.paginate_has_more(
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
            with datatable.pagination_has_more(
                request, pagination, len(items), has_more
            ):
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
            joinedload(Subscription.organization),
            joinedload(Subscription.product).joinedload(Product.organization),
            joinedload(Subscription.discount),
            selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
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

    billing_intervals = await get_billing_intervals(session, subscription)

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
                with tag.div(classes="flex flex-row gap-2"):
                    if subscription.can_cancel():
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "subscriptions:cancel", id=subscription.id
                                )
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
                    if subscription.can_reinstate():
                        with button(
                            variant="warning",
                            hx_get=str(
                                request.url_for(
                                    "subscriptions:reinstate", id=subscription.id
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Reinstate")
                    if subscription.active:
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "subscriptions:update_billing_period_end",
                                    id=subscription.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Update Billing Period End")
                    if subscription.status in STATUS_TRANSITIONS:
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "subscriptions:update_status", id=subscription.id
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Update Status")

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
                                        "organizations:detail",
                                        organization_id=i.product.organization_id,
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

            if not billing_intervals:
                with tag.div(classes="flex flex-col gap-4"):
                    with tag.h2(classes="text-2xl"):
                        text("Meters")
                    with datatable.Datatable[
                        SubscriptionMeter, SubscriptionSortProperty
                    ](
                        datatable.DatatableAttrColumn("meter.name", "Meter"),
                        datatable.DatatableAttrColumn(
                            "consumed_units", "Consumed Units"
                        ),
                        datatable.DatatableAttrColumn(
                            "credited_units", "Credited Units"
                        ),
                        SubscriptionMeterAmountColumn(subscription.currency),
                    ).render(request, subscription.meters):
                        pass
            else:
                with tag.div(classes="flex flex-col gap-4"):
                    with tag.h2(classes="text-2xl"):
                        text("Billing Intervals")
                    orders_by_id = {order.id: order for order in orders}
                    for meter, usages in billing_intervals.items():
                        with tag.h3(classes="text-lg font-semibold"):
                            text(meter.name)
                        for usage in usages:
                            with interval_usage_card(
                                request, usage, orders_by_id, subscription.currency
                            ):
                                pass

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
    subscription = await subscription_repository.get_by_id(
        id, options=subscription_repository.get_eager_options()
    )

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
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service._perform_cancellation(
                    session,
                    ctx,
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
    subscription = await subscription_repository.get_by_id(
        id, options=subscription_repository.get_eager_options()
    )

    if subscription is None:
        raise HTTPException(status_code=404)

    if not subscription.can_uncancel():
        await add_toast(request, "This subscription cannot be uncanceled.", "error")
        return

    if request.method == "POST":
        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.uncancel(session, ctx, subscription)
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


@router.api_route(
    "/{id}/reinstate", name="subscriptions:reinstate", methods=["GET", "POST"]
)
async def reinstate(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(
        id, options=subscription_repository.get_eager_options()
    )

    if subscription is None:
        raise HTTPException(status_code=404)

    if not subscription.can_reinstate():
        await add_toast(request, "This subscription cannot be reinstated.", "error")
        return

    if request.method == "POST":
        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.reinstate(session, ctx, subscription)
        return HXRedirectResponse(
            request, str(request.url_for("subscriptions:get", id=id)), 303
        )

    with modal("Reinstate subscription", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to reinstate this subscription?")
            with alert("warning", soft=True):
                with tag.div(classes="flex flex-col gap-1"):
                    with tag.p(classes="font-semibold"):
                        text("Billing will resume")
                    with tag.p():
                        text(
                            "No charge will be created immediately. "
                            "The subscription cycle will resume, and the customer "
                            "will start being billed again when the next cycle begins."
                        )
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="button",
                    variant="warning",
                    hx_post=str(request.url),
                    hx_target="#modal",
                ):
                    text("Reinstate")


@router.api_route(
    "/{id}/update_billing_period_end",
    name="subscriptions:update_billing_period_end",
    methods=["GET", "POST"],
)
async def update_billing_period_end(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(
        id, options=subscription_repository.get_eager_options()
    )

    if subscription is None:
        raise HTTPException(status_code=404)

    if not subscription.active:
        await add_toast(request, "This subscription is not active.", "error")
        return

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = UpdateBillingPeriodEndForm.model_validate_form(data)
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_currrent_billing_period_end(
                    session,
                    ctx,
                    subscription,
                    new_period_end=form.new_period_end,
                )
            return HXRedirectResponse(
                request, str(request.url_for("subscriptions:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e

    prefill_data = (
        {"new_period_end": subscription.current_period_end.strftime("%Y-%m-%dT%H:%M")}
        if subscription.current_period_end is not None
        else None
    )

    with modal("Update billing period end", open=True):
        with UpdateBillingPeriodEndForm.render(
            data=prefill_data,
            hx_post=str(
                request.url_for("subscriptions:update_billing_period_end", id=id)
            ),
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
    "/{id}/update_status", name="subscriptions:update_status", methods=["GET", "POST"]
)
async def update_status(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    subscription_repository = SubscriptionRepository.from_session(session)
    subscription = await subscription_repository.get_by_id(
        id, options=subscription_repository.get_eager_options()
    )

    if subscription is None:
        raise HTTPException(status_code=404)

    targets = STATUS_TRANSITIONS.get(subscription.status, set())
    if not targets:
        await add_toast(
            request, "This subscription's status cannot be updated.", "error"
        )
        return

    update_status_form = build_update_status_form(
        sorted(targets), subscription.status == SubscriptionStatus.past_due
    )

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = update_status_form.model_validate_form(data)
            if form.status not in targets:
                await add_toast(
                    request,
                    f"Cannot update this subscription to {form.status.value}.",
                    "error",
                )
                return
            if (subscription.status, form.status) == (
                SubscriptionStatus.past_due,
                SubscriptionStatus.active,
            ):
                await subscription_service.mark_active(session, subscription)
                if form.void_pending_orders:
                    await order_service.void_pending_orders_for_subscription(
                        session, subscription
                    )
            await add_toast(request, "Subscription status updated.", "success")
            return HXRedirectResponse(
                request, str(request.url_for("subscriptions:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e

    with modal("Update subscription status", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with alert("warning", soft=True):
                with tag.p():
                    text(
                        "This triggers the full lifecycle side effects: "
                        "webhooks, customer emails and benefit grants or revokes."
                    )
            with update_status_form.render(
                hx_post=str(request.url_for("subscriptions:update_status", id=id)),
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

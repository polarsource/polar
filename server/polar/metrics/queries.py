import uuid
from collections.abc import Generator, Sequence
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import TYPE_CHECKING, Protocol, cast

from sqlalchemy import (
    CTE,
    ColumnElement,
    Integer,
    Numeric,
    Select,
    SQLColumnExpression,
    and_,
    case,
    cte,
    func,
    literal,
    or_,
    select,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.kit.time_queries import TimeInterval
from polar.models import (
    Checkout,
    CheckoutProduct,
    Customer,
    Event,
    Order,
    Organization,
    Product,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.product import ProductBillingType
from polar.models.transaction import TransactionType

if TYPE_CHECKING:
    from .metrics import SQLMetric


class MetricQuery(StrEnum):
    orders = "orders"
    active_subscriptions = "active_subscriptions"
    checkouts = "checkouts"
    canceled_subscriptions = "canceled_subscriptions"
    churned_subscriptions = "churned_subscriptions"
    events = "events"


def _get_metrics_columns(
    metric_cte: MetricQuery,
    timestamp_column: ColumnElement[datetime],
    interval: TimeInterval,
    metrics: list["type[SQLMetric]"],
    now: datetime,
) -> Generator[ColumnElement[int] | ColumnElement[float], None, None]:
    return (
        func.coalesce(
            metric.get_sql_expression(timestamp_column, interval, now), 0
        ).label(metric.slug)
        for metric in metrics
        if metric.query == metric_cte
    )


class QueryCallable(Protocol):
    def __call__(
        self,
        timestamp_series: CTE,
        interval: TimeInterval,
        auth_subject: AuthSubject[User | Organization],
        metrics: list["type[SQLMetric]"],
        now: datetime,
        *,
        bounds: tuple[datetime, datetime],
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
    ) -> CTE: ...


def _get_readable_orders_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Order.id).join(
        Product, onclause=Order.product_id == Product.id, isouter=True
    )

    if is_user(auth_subject):
        statement = statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Product.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Product.organization_id.in_(organization_id))

    if product_id is not None:
        statement = statement.where(Order.product_id.in_(product_id))

    if billing_type is not None:
        statement = statement.where(Product.billing_type.in_(billing_type))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=Order.customer_id == Customer.id,
        ).where(Customer.id.in_(customer_id))

    return statement


def get_orders_metrics_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_orders_statement = _get_readable_orders_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    day_column = interval.sql_date_trunc(Order.created_at)

    cumulative_metrics = ["cumulative_revenue", "net_cumulative_revenue"]
    cumulative_metrics_to_compute = [
        m
        for m in metrics
        if m.query == MetricQuery.orders and m.slug in cumulative_metrics
    ]

    min_timestamp_subquery = select(
        func.min(timestamp_series.c.timestamp)
    ).scalar_subquery()

    # Only create historical baseline CTE if we have cumulative metrics
    historical_baseline = None
    if any(m.slug in cumulative_metrics for m in metrics):
        historical_baseline = cte(
            select(
                func.coalesce(func.sum(Order.net_amount), 0).label(
                    "hist_cumulative_revenue"
                ),
                func.coalesce(func.sum(Order.payout_amount), 0).label(
                    "hist_net_cumulative_revenue"
                ),
            )
            .select_from(Order)
            .where(
                Order.paid.is_(True),
                Order.id.in_(readable_orders_statement),
                Order.created_at < start_timestamp,
            )
        )

    daily_metrics = cte(
        select(
            day_column.label("day"),
            *[
                func.coalesce(
                    metric.get_sql_expression(day_column, interval, now), 0
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.orders
            ],
        )
        .select_from(Order)
        .join(
            Subscription,
            isouter=True,
            onclause=Order.subscription_id == Subscription.id,
        )
        .where(
            Order.paid.is_(True),
            Order.id.in_(readable_orders_statement),
            Order.created_at >= start_timestamp,
            Order.created_at <= end_timestamp,
        )
        .group_by(day_column)
    )

    # Build from clause with conditional cross join
    from_clause = timestamp_series.join(
        daily_metrics,
        onclause=daily_metrics.c.day == timestamp_column,
        isouter=True,
    )

    if historical_baseline is not None:
        # Cross join: every row gets the historical baseline values
        from_clause = from_clause.join(
            historical_baseline,
            isouter=False,
            onclause=literal(True),  # This creates a cross join (cartesian product)
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *[
                (
                    func.coalesce(
                        func.sum(getattr(daily_metrics.c, metric.slug)).over(
                            order_by=timestamp_column
                        ),
                        0,
                    )
                    + (
                        getattr(historical_baseline.c, f"hist_{metric.slug}")
                        if historical_baseline is not None
                        else 0
                    )
                    if metric.slug in cumulative_metrics
                    else func.coalesce(getattr(daily_metrics.c, metric.slug), 0)
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.orders
            ],
        )
        .select_from(from_clause)
        .order_by(timestamp_column.asc())
    )


def get_active_subscriptions_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_orders_statement = _get_readable_orders_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    fx_value = func.coalesce(
        func.nullif(func.cast(Transaction.exchange_rate, Numeric(30, 12)), 0),
        func.cast(Transaction.amount, Numeric(30, 12))
        / func.nullif(func.cast(Transaction.presentment_amount, Numeric(30, 12)), 0),
    )
    fx_day = interval.sql_date_trunc(Order.created_at)
    fx_currency = func.lower(Transaction.presentment_currency)

    bucketed_fx = cte(
        select(
            fx_day.label("timestamp"),
            fx_currency.label("presentment_currency"),
            func.avg(fx_value).label("avg_exchange_rate"),
        )
        .select_from(Transaction)
        .join(Order, Order.id == Transaction.order_id)
        .where(
            Transaction.type == TransactionType.payment,
            Order.created_at >= start_timestamp,
            Order.created_at <= end_timestamp,
            Transaction.presentment_currency.is_not(None),
            Transaction.order_id.in_(readable_orders_statement),
        )
        .group_by(fx_day, fx_currency)
    )

    converted_amount = func.round(
        Subscription.amount * func.coalesce(bucketed_fx.c.avg_exchange_rate, 1)
    )
    monthly_amount = case(
        (
            Subscription.recurring_interval == SubscriptionRecurringInterval.year,
            func.round(converted_amount / (12 * Subscription.recurring_interval_count)),
        ),
        (
            Subscription.recurring_interval == SubscriptionRecurringInterval.month,
            func.round(converted_amount / Subscription.recurring_interval_count),
        ),
        (
            Subscription.recurring_interval == SubscriptionRecurringInterval.week,
            func.round(
                converted_amount * 52 / (12 * Subscription.recurring_interval_count)
            ),
        ),
        (
            Subscription.recurring_interval == SubscriptionRecurringInterval.day,
            func.round(
                converted_amount * 365 / (12 * Subscription.recurring_interval_count)
            ),
        ),
    )

    monthly_recurring_revenue = func.coalesce(func.sum(monthly_amount), 0)
    committed_monthly_recurring_revenue = func.coalesce(
        func.sum(monthly_amount).filter(
            or_(
                func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(None),
                interval.sql_date_trunc(
                    cast(
                        SQLColumnExpression[datetime],
                        func.coalesce(Subscription.ended_at, Subscription.ends_at),
                    )
                )
                < interval.sql_date_trunc(now),
            )
        ),
        0,
    )
    active_subscriber_count = func.count(Subscription.customer_id.distinct())
    average_revenue_per_user = func.cast(
        case(
            (active_subscriber_count == 0, 0),
            else_=func.round(monthly_recurring_revenue / active_subscriber_count),
        ),
        Integer,
    )

    active_subscriptions_metrics = [
        metric for metric in metrics if metric.query == MetricQuery.active_subscriptions
    ]

    metric_columns: list[ColumnElement[int] | ColumnElement[float]] = []
    for metric in active_subscriptions_metrics:
        if metric.slug == "monthly_recurring_revenue":
            expression: ColumnElement[int] | ColumnElement[float] = (
                monthly_recurring_revenue
            )
        elif metric.slug == "committed_monthly_recurring_revenue":
            expression = committed_monthly_recurring_revenue
        elif metric.slug == "average_revenue_per_user":
            expression = average_revenue_per_user
        else:
            expression = metric.get_sql_expression(timestamp_column, interval, now)
        metric_columns.append(func.coalesce(expression, 0).label(metric.slug))

    from_clause = timestamp_series.join(
        Subscription,
        isouter=True,
        onclause=and_(
            or_(
                Subscription.started_at.is_(None),
                interval.sql_date_trunc(
                    cast(SQLColumnExpression[datetime], Subscription.started_at)
                )
                <= interval.sql_date_trunc(timestamp_column),
            ),
            or_(
                func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(None),
                interval.sql_date_trunc(
                    cast(
                        SQLColumnExpression[datetime],
                        func.coalesce(Subscription.ended_at, Subscription.ends_at),
                    )
                )
                > interval.sql_date_trunc(timestamp_column),
            ),
            Subscription.id.in_(readable_subscriptions_statement),
            # Filter to only include subscriptions that overlap with the original bounds
            or_(
                Subscription.started_at.is_(None),
                Subscription.started_at <= end_timestamp,
            ),
            or_(
                func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(None),
                func.coalesce(Subscription.ended_at, Subscription.ends_at)
                >= start_timestamp,
            ),
        ),
    ).join(
        bucketed_fx,
        isouter=True,
        onclause=and_(
            bucketed_fx.c.timestamp == timestamp_column,
            bucketed_fx.c.presentment_currency == func.lower(Subscription.currency),
        ),
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *metric_columns,
        )
        .select_from(from_clause)
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def _get_readable_subscriptions_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Subscription.id).join(
        Product, onclause=Subscription.product_id == Product.id
    )

    if is_user(auth_subject):
        statement = statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Product.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Product.organization_id.in_(organization_id))

    if product_id is not None:
        statement = statement.where(Subscription.product_id.in_(product_id))

    if billing_type is not None:
        statement = statement.where(Product.billing_type.in_(billing_type))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=Subscription.customer_id == Customer.id,
        ).where(Customer.id.in_(customer_id))

    return statement


# Cutoff date when opened_at tracking was shipped
# Before this date: use created_at for all checkouts (preserve historical data)
# After this date: only count checkouts that have opened_at set
# See: https://github.com/polarsource/polar/pull/9071
CHECKOUT_OPENED_AT_CUTOFF = datetime(2026, 1, 22, 12, 13, 0, tzinfo=UTC)


def get_checkouts_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    # `opened_at` tracks when the checkout page was first viewed by a customer
    # which excludes premature API checkout sessions that were never visited
    opened_at_column = func.cast(
        Checkout.analytics_metadata["opened_at"].astext, TIMESTAMP(timezone=True)
    )

    # Conditional effective_timestamp based on cutoff date:
    # - Before cutoff: Use COALESCE(opened_at, created_at) for historical data
    # - After cutoff: Use opened_at directly (NULL means not opened, should be excluded)
    effective_timestamp = case(
        (
            Checkout.created_at < CHECKOUT_OPENED_AT_CUTOFF,
            func.coalesce(opened_at_column, Checkout.created_at),
        ),
        else_=opened_at_column,
    )

    readable_checkouts_statement = (
        select(Checkout.id)
        .join(CheckoutProduct, CheckoutProduct.checkout_id == Checkout.id)
        .join(Product, onclause=CheckoutProduct.product_id == Product.id)
        # Performance optimization: filter by created_at (indexed) before JSONB access.
        # Since opened_at >= created_at and opened_at <= expires_at = created_at + TTL:
        # - created_at <= end_timestamp: checkout can't be opened after end if created after end
        # - created_at >= start_timestamp - TTL: checkout can't be opened in range if created
        #   more than TTL before the start (it would have expired)
        # Filtering on `created_at` twice should allow the planner to scan an index
        # versus filering on `expires_at` too (though that would be more correct)
        # (especially if CHECKOUT_TTL_SECONDS were to change)
        .where(
            Checkout.created_at <= end_timestamp,
            Checkout.created_at
            >= start_timestamp - timedelta(seconds=settings.CHECKOUT_TTL_SECONDS),
        )
    )

    if is_user(auth_subject):
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            )
        )
    elif is_organization(auth_subject):
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id == auth_subject.subject.id
        )

    if organization_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.organization_id.in_(organization_id)
        )

    if product_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            CheckoutProduct.product_id.in_(product_id)
        )

    if billing_type is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Product.billing_type.in_(billing_type)
        )

    if customer_id is not None:
        readable_checkouts_statement = readable_checkouts_statement.where(
            Checkout.customer_id.in_(customer_id)
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.checkouts, timestamp_column, interval, metrics, now
            ),
        )
        .select_from(
            timestamp_series.join(
                Checkout,
                isouter=True,
                onclause=and_(
                    or_(
                        Checkout.created_at < CHECKOUT_OPENED_AT_CUTOFF,
                        Checkout.analytics_metadata["opened_at"].isnot(None),
                    ),
                    interval.sql_date_trunc(effective_timestamp)
                    == interval.sql_date_trunc(timestamp_column),
                    Checkout.id.in_(readable_checkouts_statement),
                    effective_timestamp >= start_timestamp,
                    effective_timestamp <= end_timestamp,
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_canceled_subscriptions_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.canceled_subscriptions,
                timestamp_column,
                interval,
                metrics,
                now,
            ),
        )
        .select_from(
            timestamp_series.join(
                Subscription,
                isouter=True,
                onclause=and_(
                    Subscription.canceled_at.is_not(None),
                    interval.sql_date_trunc(
                        cast(SQLColumnExpression[datetime], Subscription.canceled_at)
                    )
                    == interval.sql_date_trunc(timestamp_column),
                    Subscription.id.in_(readable_subscriptions_statement),
                    Subscription.canceled_at >= start_timestamp,
                    Subscription.canceled_at <= end_timestamp,
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def get_churned_subscriptions_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.churned_subscriptions,
                timestamp_column,
                interval,
                metrics,
                now,
            ),
        )
        .select_from(
            timestamp_series.join(
                Subscription,
                isouter=True,
                onclause=and_(
                    func.coalesce(Subscription.ended_at, Subscription.ends_at).is_not(
                        None
                    ),
                    interval.sql_date_trunc(
                        cast(
                            SQLColumnExpression[datetime],
                            func.coalesce(Subscription.ended_at, Subscription.ends_at),
                        )
                    )
                    == interval.sql_date_trunc(timestamp_column),
                    Subscription.id.in_(readable_subscriptions_statement),
                    func.coalesce(Subscription.ended_at, Subscription.ends_at)
                    >= start_timestamp,
                    func.coalesce(Subscription.ended_at, Subscription.ends_at)
                    <= end_timestamp,
                ),
            )
        )
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def _get_readable_cost_events_statement(
    *,
    auth_subject: AuthSubject[User | Organization],
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = select(Event.id).where(Event.user_metadata["_cost"].is_not(None))

    if is_user(auth_subject):
        statement = statement.where(
            Event.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            )
        )
    elif is_organization(auth_subject):
        statement = statement.where(Event.organization_id == auth_subject.subject.id)

    if organization_id is not None:
        statement = statement.where(Event.organization_id.in_(organization_id))

    if customer_id is not None:
        statement = statement.join(
            Customer,
            onclause=or_(
                Event.customer_id == Customer.id,
                and_(
                    Customer.external_id.is_not(None),
                    Event.external_customer_id == Customer.external_id,
                    Event.organization_id == Customer.organization_id,
                ),
            ),
        ).where(Customer.id.in_(customer_id))

    return statement


def get_events_metrics_cte(
    timestamp_series: CTE,
    interval: TimeInterval,
    auth_subject: AuthSubject[User | Organization],
    metrics: list["type[SQLMetric]"],
    now: datetime,
    *,
    bounds: tuple[datetime, datetime],
    organization_id: Sequence[uuid.UUID] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
) -> CTE:
    start_timestamp, end_timestamp = bounds
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp
    day_column = interval.sql_date_trunc(Event.timestamp)
    has_cumulative_costs = any(
        metric.query == MetricQuery.events and metric.slug == "cumulative_costs"
        for metric in metrics
    )

    daily_statement = (
        select(
            day_column.label("day"),
            *[
                func.coalesce(
                    metric.get_sql_expression(day_column, interval, now), 0
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.events
            ],
        )
        .select_from(Event)
        .where(
            Event.timestamp >= start_timestamp,
            Event.timestamp <= end_timestamp,
        )
    )

    # Apply organization filter
    if organization_id is not None:
        if len(organization_id) == 1:
            daily_statement = daily_statement.where(
                Event.organization_id == organization_id[0]
            )
        else:
            daily_statement = daily_statement.where(
                Event.organization_id.in_(organization_id)
            )
    elif is_organization(auth_subject):
        daily_statement = daily_statement.where(
            Event.organization_id == auth_subject.subject.id
        )
    elif is_user(auth_subject):
        daily_statement = daily_statement.where(
            Event.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            )
        )

    # Apply customer filter
    if customer_id is not None:
        daily_statement = daily_statement.join(
            Customer,
            onclause=or_(
                Event.customer_id == Customer.id,
                and_(
                    Customer.external_id.is_not(None),
                    Event.external_customer_id == Customer.external_id,
                    Event.organization_id == Customer.organization_id,
                ),
            ),
        ).where(Customer.id.in_(customer_id))

    daily_statement = daily_statement.group_by(day_column)
    daily_metrics = cte(daily_statement)
    historical_baseline = None
    if has_cumulative_costs:
        readable_cost_events_statement = _get_readable_cost_events_statement(
            auth_subject=auth_subject,
            organization_id=organization_id,
            customer_id=customer_id,
        )
        historical_baseline = cte(
            select(
                func.coalesce(
                    func.sum(Event.user_metadata["_cost"]["amount"].as_numeric(17, 12)),
                    0,
                ).label("hist_cumulative_costs")
            )
            .select_from(Event)
            .where(
                Event.user_metadata["_cost"].is_not(None),
                Event.id.in_(readable_cost_events_statement),
                Event.timestamp < start_timestamp,
            )
        )

    from_clause = timestamp_series.join(
        daily_metrics,
        onclause=daily_metrics.c.day == timestamp_column,
        isouter=True,
    )
    if historical_baseline is not None:
        from_clause = from_clause.join(
            historical_baseline,
            isouter=False,
            onclause=literal(True),
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *[
                (
                    func.coalesce(
                        func.sum(getattr(daily_metrics.c, metric.slug)).over(
                            order_by=timestamp_column
                        ),
                        0,
                    )
                    + (
                        historical_baseline.c.hist_cumulative_costs
                        if historical_baseline is not None
                        else 0
                    )
                    if metric.slug == "cumulative_costs"
                    else func.coalesce(getattr(daily_metrics.c, metric.slug), 0)
                ).label(metric.slug)
                for metric in metrics
                if metric.query == MetricQuery.events
            ],
        )
        .select_from(from_clause)
        .order_by(timestamp_column.asc())
    )


QUERIES: list[QueryCallable] = [
    get_orders_metrics_cte,
    get_active_subscriptions_cte,
    get_checkouts_cte,
    get_canceled_subscriptions_cte,
    get_churned_subscriptions_cte,
    get_events_metrics_cte,
]

# Mapping from MetricQuery enum to query function for filtering
QUERY_TO_FUNCTION: dict[MetricQuery, QueryCallable] = {
    MetricQuery.orders: get_orders_metrics_cte,
    MetricQuery.active_subscriptions: get_active_subscriptions_cte,
    MetricQuery.checkouts: get_checkouts_cte,
    MetricQuery.canceled_subscriptions: get_canceled_subscriptions_cte,
    MetricQuery.churned_subscriptions: get_churned_subscriptions_cte,
    MetricQuery.events: get_events_metrics_cte,
}

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
    exists,
    func,
    or_,
    select,
    text,
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
    CustomerSeat,
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
    churn_rate = "churn_rate"
    events = "events"
    seats = "seats"


def _get_metrics_columns(
    metric_cte: MetricQuery,
    timestamp_column: ColumnElement[datetime],
    interval: TimeInterval,
    metrics: list["type[SQLMetric]"],
    now: datetime,
) -> Generator[ColumnElement[int] | ColumnElement[float], None, None]:
    for metric in metrics:
        if metric.query != metric_cte:
            continue
        try:
            expr = metric.get_sql_expression(timestamp_column, interval, now)
        except NotImplementedError:
            continue
        yield func.coalesce(expr, 0).label(metric.slug)


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

    global_fx_day = func.date_trunc("day", Transaction.created_at)
    global_fx_daily = cte(
        select(
            global_fx_day.label("day"),
            fx_currency.label("presentment_currency"),
            func.avg(fx_value).label("avg_exchange_rate"),
        )
        .select_from(Transaction)
        .where(
            Transaction.type == TransactionType.payment,
            Transaction.presentment_currency.is_not(None),
            Transaction.created_at >= start_timestamp,
            Transaction.created_at <= end_timestamp,
        )
        .group_by(global_fx_day, fx_currency)
    )

    closest_global_fx_rate = (
        select(global_fx_daily.c.avg_exchange_rate)
        .where(
            global_fx_daily.c.presentment_currency == func.lower(Subscription.currency),
        )
        .order_by(
            func.abs(
                func.extract(
                    "epoch",
                    global_fx_daily.c.day - timestamp_column,
                )
            )
        )
        .limit(1)
        .correlate(Subscription, timestamp_series)
        .scalar_subquery()
    )

    bucketed_fx_rate = (
        select(bucketed_fx.c.avg_exchange_rate)
        .where(
            bucketed_fx.c.timestamp == timestamp_column,
            bucketed_fx.c.presentment_currency == func.lower(Subscription.currency),
        )
        .correlate(Subscription, timestamp_series)
        .scalar_subquery()
    )

    # TODO: Change this to look at the organization settlement currency
    # when it can be something else than USD
    converted_amount = case(
        (
            func.lower(Subscription.currency) == "usd",
            Subscription.amount,
        ),
        else_=func.round(
            Subscription.amount
            * func.coalesce(
                bucketed_fx_rate,
                closest_global_fx_rate,
                1,
            )
        ),
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


def get_churn_rate_cte(
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
    timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

    readable_subscriptions_statement = _get_readable_subscriptions_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    if interval == TimeInterval.year:
        window_start = timestamp_column
        window_end = timestamp_column + interval.sql_interval()
    else:
        window_start = timestamp_column - text("'30 days'::interval")
        window_end = timestamp_column

    canceled_30d = func.count(
        case(
            (
                and_(
                    Subscription.canceled_at.is_not(None),
                    Subscription.canceled_at >= window_start,
                    Subscription.canceled_at < window_end,
                ),
                Subscription.id,
            ),
        )
    )

    active_at_window_start = func.count(
        case(
            (
                and_(
                    or_(
                        Subscription.started_at.is_(None),
                        Subscription.started_at <= window_start,
                    ),
                    or_(
                        func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(
                            None
                        ),
                        func.coalesce(Subscription.ended_at, Subscription.ends_at)
                        > window_start,
                    ),
                ),
                Subscription.id,
            ),
        )
    )

    churn_rate = case(
        (
            active_at_window_start > 0,
            func.cast(canceled_30d, Numeric)
            / func.cast(active_at_window_start, Numeric),
        ),
        else_=0,
    )

    from_clause = timestamp_series.join(
        Subscription,
        isouter=True,
        onclause=and_(
            Subscription.id.in_(readable_subscriptions_statement),
            or_(
                and_(
                    or_(
                        Subscription.started_at.is_(None),
                        Subscription.started_at <= window_start,
                    ),
                    or_(
                        func.coalesce(Subscription.ended_at, Subscription.ends_at).is_(
                            None
                        ),
                        func.coalesce(Subscription.ended_at, Subscription.ends_at)
                        > window_start,
                    ),
                ),
                and_(
                    Subscription.canceled_at.is_not(None),
                    Subscription.canceled_at >= window_start,
                    Subscription.canceled_at < window_end,
                ),
            ),
        ),
    )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            churn_rate.label("churn_rate"),
        )
        .select_from(from_clause)
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


def _get_readable_seats_statement(
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: Sequence[uuid.UUID] | None = None,
    product_id: Sequence[uuid.UUID] | None = None,
    billing_type: Sequence[ProductBillingType] | None = None,
    customer_id: Sequence[uuid.UUID] | None = None,
) -> Select[tuple[uuid.UUID]]:
    statement = (
        select(CustomerSeat.id)
        .outerjoin(Subscription, CustomerSeat.subscription_id == Subscription.id)
        .outerjoin(Order, CustomerSeat.order_id == Order.id)
        .join(
            Product,
            Product.id == func.coalesce(Subscription.product_id, Order.product_id),
        )
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
        statement = statement.where(
            func.coalesce(Subscription.product_id, Order.product_id).in_(product_id)
        )

    if billing_type is not None:
        statement = statement.where(Product.billing_type.in_(billing_type))

    if customer_id is not None:
        statement = statement.where(
            func.coalesce(Subscription.customer_id, Order.customer_id).in_(customer_id)
        )

    return statement


def get_seats_cte(
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

    readable_seats_statement = _get_readable_seats_statement(
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
    )

    from_clause = (
        timestamp_series.join(
            CustomerSeat,
            isouter=True,
            onclause=and_(
                interval.sql_date_trunc(
                    cast(SQLColumnExpression[datetime], CustomerSeat.created_at)
                )
                <= interval.sql_date_trunc(timestamp_column),
                or_(
                    CustomerSeat.revoked_at.is_(None),
                    interval.sql_date_trunc(
                        cast(
                            SQLColumnExpression[datetime],
                            CustomerSeat.revoked_at,
                        )
                    )
                    > interval.sql_date_trunc(timestamp_column),
                ),
                CustomerSeat.id.in_(readable_seats_statement),
                CustomerSeat.created_at <= end_timestamp,
                or_(
                    CustomerSeat.revoked_at.is_(None),
                    CustomerSeat.revoked_at >= start_timestamp,
                ),
            ),
        )
        .join(
            Subscription,
            CustomerSeat.subscription_id == Subscription.id,
            isouter=True,
        )
        .join(
            Order,
            CustomerSeat.order_id == Order.id,
            isouter=True,
        )
    )

    slugs_needed = {m.slug for m in metrics if m.query == MetricQuery.seats}
    direct_columns: list[ColumnElement[int]] = []

    if "new_seat_customers" in slugs_needed:
        billing_customer = func.coalesce(
            CustomerSeat.customer_id,
            Subscription.customer_id,
            Order.customer_id,
        )
        cs_e = CustomerSeat.__table__.alias("cs_earlier")
        sub_e = Subscription.__table__.alias("sub_earlier")
        ord_e = Order.__table__.alias("ord_earlier")
        has_earlier_seat = exists(
            select(1)
            .select_from(cs_e)
            .outerjoin(sub_e, cs_e.c.subscription_id == sub_e.c.id)
            .outerjoin(ord_e, cs_e.c.order_id == ord_e.c.id)
            .where(
                func.coalesce(
                    cs_e.c.customer_id,
                    sub_e.c.customer_id,
                    ord_e.c.customer_id,
                )
                == billing_customer,
                interval.sql_date_trunc(
                    cast(SQLColumnExpression[datetime], cs_e.c.created_at)
                )
                < interval.sql_date_trunc(timestamp_column),
                cs_e.c.id.in_(readable_seats_statement),
            )
            .correlate(CustomerSeat, Subscription, Order, timestamp_series)
        )
        direct_columns.append(
            func.coalesce(
                func.count(func.distinct(billing_customer)).filter(
                    interval.sql_date_trunc(
                        cast(
                            SQLColumnExpression[datetime],
                            CustomerSeat.created_at,
                        )
                    )
                    == interval.sql_date_trunc(timestamp_column),
                    ~has_earlier_seat,
                ),
                0,
            ).label("new_seat_customers")
        )

    if "churned_seat_customers" in slugs_needed:
        cs_c = CustomerSeat.__table__.alias("cs_churned")
        sub_c = Subscription.__table__.alias("sub_churned")
        ord_c = Order.__table__.alias("ord_churned")
        churned_sub = (
            select(
                func.coalesce(
                    cs_c.c.customer_id,
                    sub_c.c.customer_id,
                    ord_c.c.customer_id,
                ).label("billing_customer_id")
            )
            .select_from(cs_c)
            .outerjoin(sub_c, cs_c.c.subscription_id == sub_c.c.id)
            .outerjoin(ord_c, cs_c.c.order_id == ord_c.c.id)
            .where(
                cs_c.c.id.in_(readable_seats_statement),
                cs_c.c.revoked_at.is_not(None),
            )
            .group_by("billing_customer_id")
            .having(
                func.count(cs_c.c.id) == func.count(cs_c.c.revoked_at),
                interval.sql_date_trunc(
                    cast(
                        SQLColumnExpression[datetime],
                        func.max(cs_c.c.revoked_at),
                    )
                )
                == interval.sql_date_trunc(timestamp_column),
            )
            .correlate(timestamp_series)
        )
        direct_columns.append(
            func.coalesce(
                select(func.count())
                .select_from(churned_sub.subquery())
                .correlate(timestamp_series)
                .scalar_subquery(),
                0,
            ).label("churned_seat_customers")
        )

    return cte(
        select(
            timestamp_column.label("timestamp"),
            *_get_metrics_columns(
                MetricQuery.seats, timestamp_column, interval, metrics, now
            ),
            *direct_columns,
        )
        .select_from(from_clause)
        .group_by(timestamp_column)
        .order_by(timestamp_column.asc())
    )


QUERIES: list[QueryCallable] = [
    get_active_subscriptions_cte,
    get_checkouts_cte,
    get_churned_subscriptions_cte,
    get_churn_rate_cte,
    get_seats_cte,
]

QUERY_TO_FUNCTION: dict[MetricQuery, QueryCallable] = {
    MetricQuery.active_subscriptions: get_active_subscriptions_cte,
    MetricQuery.checkouts: get_checkouts_cte,
    MetricQuery.churned_subscriptions: get_churned_subscriptions_cte,
    MetricQuery.churn_rate: get_churn_rate_cte,
    MetricQuery.seats: get_seats_cte,
}

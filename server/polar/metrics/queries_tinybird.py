from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from polar.integrations.tinybird.client import client as tinybird_client
from polar.kit.time_queries import TimeInterval


class TinybirdQuery(StrEnum):
    balance_orders = "balance_orders"
    mrr = "mrr"
    events = "events"


def _format_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _build_event_filters(
    params: dict[str, Any],
    *,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[str]:
    filters = [
        "e.source = 'system'",
        "e.name IN ('balance.order', 'balance.credit_order', 'balance.refund')",
        "e.organization_id IN {org_ids:Array(String)}",
    ]
    if product_id is not None:
        params["product_ids"] = [str(id) for id in product_id]
        filters.append("e.product_id IN {product_ids:Array(String)}")
    if customer_id is not None:
        params["customer_ids"] = [str(id) for id in customer_id]
        filters.append("e.customer_id IN {customer_ids:Array(String)}")
    if billing_type is not None:
        params["billing_types"] = list(billing_type)
        filters.append("e.billing_type IN {billing_types:Array(String)}")
    return filters


def _build_balance_orders_sql(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    bounds_start: datetime | None = None,
    bounds_end: datetime | None = None,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> tuple[str, dict[str, Any]]:
    iv = interval.value
    b_start = bounds_start or start
    b_end = bounds_end or end
    params: dict[str, Any] = {
        "iv": iv,
        "org_ids": [str(id) for id in organization_id],
        "start_dt": _format_dt(start),
        "end_dt": _format_dt(end),
        "bounds_start": _format_dt(b_start),
        "bounds_end": _format_dt(b_end),
        "tz": timezone,
        "buffer_start": _format_dt(b_start - timedelta(days=1)),
        "buffer_end": _format_dt(b_end + timedelta(days=1)),
    }

    event_filters = " AND ".join(
        _build_event_filters(
            params,
            product_id=product_id,
            customer_id=customer_id,
            billing_type=billing_type,
        )
    )

    sub_product_filter = ""
    if product_id is not None:
        sub_product_filter = (
            "AND argMaxMerge(product_id) IN {product_ids:Array(String)}"
        )

    sql = f"""
WITH
    windows AS (
        SELECT date_trunc({{iv:String}},
            dateAdd({iv}, number, toDateTime({{start_dt:String}}, {{tz:String}}))
        ) AS window_start
        FROM numbers(
            dateDiff({{iv:String}},
                toDateTime({{start_dt:String}}, {{tz:String}}),
                toDateTime({{end_dt:String}}, {{tz:String}})
            ) + 1
        )
    ),
    sub_state AS (
        SELECT
            subscription_id,
            minMerge(started_at) AS started_at
        FROM subscription_state
        WHERE organization_id IN {{org_ids:Array(String)}}
        {sub_product_filter}
        GROUP BY subscription_id
    ),
    baseline AS (
        SELECT
            COALESCE(sumIf(
                e.amount,
                e.name IN ('balance.order', 'balance.credit_order')
            ), 0) AS hist_revenue,
            COALESCE(
                sum(e.amount) - sum(COALESCE(e.fee, 0)),
                0
            ) AS hist_net_revenue
        FROM events_by_timestamp e
        WHERE {event_filters}
            AND COALESCE(
                JSONExtract(e.user_metadata, 'order_created_at', 'Nullable(DateTime64(3))'),
                e.timestamp
            ) < toDateTime({{bounds_start:String}}, {{tz:String}})
    ),
    daily AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(COALESCE(
                JSONExtract(e.user_metadata, 'order_created_at', 'Nullable(DateTime64(3))'),
                e.timestamp
            ), {{tz:String}})) AS day,

            countIf(e.name IN ('balance.order', 'balance.credit_order')) AS orders,

            COALESCE(sumIf(e.amount, e.name IN ('balance.order', 'balance.credit_order')), 0) AS revenue,

            COALESCE(sum(e.amount) - sum(COALESCE(e.fee, 0)), 0) AS net_revenue,

            CASE
                WHEN countIf(e.name IN ('balance.order', 'balance.credit_order')) > 0
                THEN toInt64(ceil(
                    sumIf(e.amount, e.name IN ('balance.order', 'balance.credit_order'))
                    / countIf(e.name IN ('balance.order', 'balance.credit_order'))
                ))
                ELSE 0
            END AS average_order_value,

            CASE
                WHEN countIf(e.name IN ('balance.order', 'balance.credit_order')) > 0
                THEN toInt64(ceil(
                    (sum(e.amount) - sum(COALESCE(e.fee, 0)))
                    / countIf(e.name IN ('balance.order', 'balance.credit_order'))
                ))
                ELSE 0
            END AS net_average_order_value,

            countIf(
                e.name IN ('balance.order', 'balance.credit_order')
                AND e.subscription_id IS NULL
            ) AS one_time_products,

            COALESCE(sumIf(e.amount,
                e.name IN ('balance.order', 'balance.credit_order')
                AND e.subscription_id IS NULL
            ), 0) AS one_time_products_revenue,

            COALESCE(sumIf(e.amount - COALESCE(e.fee, 0),
                e.subscription_id IS NULL
            ), 0) AS one_time_products_net_revenue,

            COALESCE(sumIf(e.amount,
                e.name IN ('balance.order', 'balance.credit_order')
                AND e.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(ss.started_at, {{tz:String}})) = day
            ), 0) AS new_subscriptions_revenue,

            COALESCE(sumIf(e.amount - COALESCE(e.fee, 0),
                e.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(ss.started_at, {{tz:String}})) = day
            ), 0) AS new_subscriptions_net_revenue,

            countDistinctIf(e.subscription_id,
                e.name IN ('balance.order', 'balance.credit_order')
                AND e.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(ss.started_at, {{tz:String}})) != day
            ) AS renewed_subscriptions,

            COALESCE(sumIf(e.amount,
                e.name IN ('balance.order', 'balance.credit_order')
                AND e.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(ss.started_at, {{tz:String}})) != day
            ), 0) AS renewed_subscriptions_revenue,

            COALESCE(sumIf(e.amount - COALESCE(e.fee, 0),
                e.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(ss.started_at, {{tz:String}})) != day
            ), 0) AS renewed_subscriptions_net_revenue

        FROM events_by_timestamp e
        LEFT JOIN sub_state ss ON toString(e.subscription_id) = toString(ss.subscription_id)
        WHERE {event_filters}
            AND e.timestamp >= toDateTime({{buffer_start:String}}, {{tz:String}})
            AND e.timestamp <= toDateTime({{buffer_end:String}}, {{tz:String}})
            AND COALESCE(
                JSONExtract(e.user_metadata, 'order_created_at', 'Nullable(DateTime64(3))'),
                e.timestamp
            ) >= toDateTime({{bounds_start:String}}, {{tz:String}})
            AND COALESCE(
                JSONExtract(e.user_metadata, 'order_created_at', 'Nullable(DateTime64(3))'),
                e.timestamp
            ) <= toDateTime({{bounds_end:String}}, {{tz:String}})
        GROUP BY day
    ),
    sub_created_daily AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(timestamp, {{tz:String}})) AS day,
            count(DISTINCT subscription_id) AS new_subscriptions
        FROM events_by_timestamp
        WHERE source = 'system'
            AND name = 'subscription.created'
            AND organization_id IN {{org_ids:Array(String)}}
            -- TODO: investigate whether this should use bounds_start/bounds_end
            -- like the balance order data, instead of the full window range.
            -- Currently matches Postgres behavior which uses the window range.
            AND timestamp >= toDateTime({{start_dt:String}}, {{tz:String}})
            AND timestamp <= toDateTime({{end_dt:String}}, {{tz:String}})
        GROUP BY day
    )
SELECT
    w.window_start AS timestamp,
    COALESCE(d.orders, 0) AS orders,
    COALESCE(d.revenue, 0) AS revenue,
    COALESCE(d.net_revenue, 0) AS net_revenue,
    COALESCE(sum(d.revenue) OVER (ORDER BY w.window_start), 0)
        + b.hist_revenue AS cumulative_revenue,
    COALESCE(sum(d.net_revenue) OVER (ORDER BY w.window_start), 0)
        + b.hist_net_revenue AS net_cumulative_revenue,
    COALESCE(d.average_order_value, 0) AS average_order_value,
    COALESCE(d.net_average_order_value, 0) AS net_average_order_value,
    COALESCE(d.one_time_products, 0) AS one_time_products,
    COALESCE(d.one_time_products_revenue, 0) AS one_time_products_revenue,
    COALESCE(d.one_time_products_net_revenue, 0) AS one_time_products_net_revenue,
    COALESCE(sc.new_subscriptions, 0) AS new_subscriptions,
    COALESCE(d.new_subscriptions_revenue, 0) AS new_subscriptions_revenue,
    COALESCE(d.new_subscriptions_net_revenue, 0) AS new_subscriptions_net_revenue,
    COALESCE(d.renewed_subscriptions, 0) AS renewed_subscriptions,
    COALESCE(d.renewed_subscriptions_revenue, 0) AS renewed_subscriptions_revenue,
    COALESCE(d.renewed_subscriptions_net_revenue, 0) AS renewed_subscriptions_net_revenue
FROM windows w
LEFT JOIN daily d ON d.day = w.window_start
LEFT JOIN sub_created_daily sc ON sc.day = w.window_start
CROSS JOIN baseline b
ORDER BY w.window_start
"""

    return sql, params


def _build_mrr_sql(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    now: datetime,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> tuple[str, dict[str, Any]]:
    iv = interval.value
    params: dict[str, Any] = {
        "iv": iv,
        "org_ids": [str(id) for id in organization_id],
        "start_dt": _format_dt(start),
        "end_dt": _format_dt(end),
        "now_dt": _format_dt(now),
        "tz": timezone,
    }

    sub_product_filter = ""
    payment_product_filter = ""
    if product_id is not None:
        params["product_ids"] = [str(id) for id in product_id]
        sub_product_filter = (
            "AND argMaxMerge(product_id) IN {product_ids:Array(String)}"
        )
        payment_product_filter = "AND product_id IN {product_ids:Array(String)}"

    sub_customer_filter = ""
    payment_customer_filter = ""
    if customer_id is not None:
        params["customer_ids"] = [str(id) for id in customer_id]
        sub_customer_filter = (
            "AND argMaxMerge(customer_id) IN {customer_ids:Array(String)}"
        )
        payment_customer_filter = "AND customer_id IN {customer_ids:Array(String)}"

    sql = f"""
WITH
    windows AS (
        SELECT date_trunc({{iv:String}},
            dateAdd({iv}, number, toDateTime({{start_dt:String}}, {{tz:String}}))
        ) AS window_start
        FROM numbers(
            dateDiff({{iv:String}},
                toDateTime({{start_dt:String}}, {{tz:String}}),
                toDateTime({{end_dt:String}}, {{tz:String}})
            ) + 1
        )
    ),
    subs AS (
        SELECT
            subscription_id,
            minMerge(started_at) AS started_at,
            argMaxMerge(ends_at) AS ends_at,
            argMaxMerge(recurring_interval) AS recurring_interval,
            argMaxMerge(recurring_interval_count) AS recurring_interval_count,
            argMaxMerge(customer_id) AS customer_id
        FROM subscription_state
        WHERE organization_id IN {{org_ids:Array(String)}}
        GROUP BY subscription_id
        -- HAVING 1=1 anchor for optional AND-prefixed aggregate filters
        HAVING 1=1
            {sub_product_filter}
            {sub_customer_filter}
    ),
    latest_payments AS (
        SELECT
            subscription_id,
            amount AS settlement_amount,
            ROW_NUMBER() OVER (
                PARTITION BY subscription_id
                ORDER BY timestamp DESC
            ) AS rn
        FROM events_by_timestamp
        WHERE source = 'system'
            AND name IN ('balance.order', 'balance.credit_order')
            AND organization_id IN {{org_ids:Array(String)}}
            AND subscription_id IS NOT NULL
            {payment_product_filter}
            {payment_customer_filter}
    ),
    latest_payment AS (
        SELECT subscription_id, settlement_amount
        FROM latest_payments
        WHERE rn = 1
    )
SELECT
    w.window_start AS timestamp,
    COALESCE(mrr.monthly_recurring_revenue, 0) AS monthly_recurring_revenue,
    COALESCE(mrr.committed_monthly_recurring_revenue, 0) AS committed_monthly_recurring_revenue,
    CASE
        WHEN COALESCE(mrr.active_subscriber_count, 0) > 0
        THEN toInt64(round(COALESCE(mrr.monthly_recurring_revenue, 0) / mrr.active_subscriber_count))
        ELSE 0
    END AS average_revenue_per_user,
    COALESCE(mrr.active_subscriptions, 0) AS active_subscriptions,
    COALESCE(mrr.committed_subscriptions, 0) AS committed_subscriptions
FROM windows w
LEFT JOIN (
    SELECT
        w2.window_start,
        sum(
            CASE
                WHEN s.recurring_interval = 'year'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) / 12))
                WHEN s.recurring_interval = 'month'
                    THEN COALESCE(lp.settlement_amount, 0)
                WHEN s.recurring_interval = 'week'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 4))
                WHEN s.recurring_interval = 'day'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 30))
                ELSE toInt64(0)
            END
        ) AS monthly_recurring_revenue,
        sumIf(
            CASE
                WHEN s.recurring_interval = 'year'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) / 12))
                WHEN s.recurring_interval = 'month'
                    THEN COALESCE(lp.settlement_amount, 0)
                WHEN s.recurring_interval = 'week'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 4))
                WHEN s.recurring_interval = 'day'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 30))
                ELSE toInt64(0)
            END,
            s.ends_at <= toDateTime64(0, 3, 'UTC')
            OR date_trunc({{iv:String}}, toDateTime(s.ends_at, {{tz:String}})) < date_trunc({{iv:String}}, toDateTime({{now_dt:String}}, {{tz:String}}))
        ) AS committed_monthly_recurring_revenue,
        count(DISTINCT s.customer_id) AS active_subscriber_count,
        count(*) AS active_subscriptions,
        countIf(
            s.ends_at <= toDateTime64(0, 3, 'UTC')
            OR date_trunc({{iv:String}}, toDateTime(s.ends_at, {{tz:String}})) < date_trunc({{iv:String}}, toDateTime({{now_dt:String}}, {{tz:String}}))
        ) AS committed_subscriptions
    FROM windows w2
    CROSS JOIN subs s
    LEFT JOIN latest_payment lp ON toString(lp.subscription_id) = toString(s.subscription_id)
    WHERE
        (s.started_at IS NULL OR date_trunc({{iv:String}}, toDateTime(s.started_at, {{tz:String}})) <= w2.window_start)
        AND (
            s.ends_at <= toDateTime64(0, 3, 'UTC')
            OR date_trunc({{iv:String}}, toDateTime(s.ends_at, {{tz:String}})) > w2.window_start
        )
    GROUP BY w2.window_start
) mrr ON mrr.window_start = w.window_start
ORDER BY w.window_start
"""

    return sql, params


def _build_events_metrics_sql(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    bounds_start: datetime | None = None,
    bounds_end: datetime | None = None,
    customer_id: Sequence[UUID] | None = None,
) -> tuple[str, dict[str, Any]]:
    iv = interval.value
    b_start = bounds_start or start
    b_end = bounds_end or end
    params: dict[str, Any] = {
        "iv": iv,
        "org_ids": [str(id) for id in organization_id],
        "start_dt": _format_dt(start),
        "end_dt": _format_dt(end),
        "bounds_start": _format_dt(b_start),
        "bounds_end": _format_dt(b_end),
        "tz": timezone,
    }

    customer_filter = ""
    if customer_id is not None:
        params["customer_ids"] = [str(id) for id in customer_id]
        customer_filter = "AND e.customer_id IN {customer_ids:Array(String)}"

    sql = f"""
WITH
    windows AS (
        SELECT date_trunc({{iv:String}},
            dateAdd({iv}, number, toDateTime({{start_dt:String}}, {{tz:String}}))
        ) AS window_start
        FROM numbers(
            dateDiff({{iv:String}},
                toDateTime({{start_dt:String}}, {{tz:String}}),
                toDateTime({{end_dt:String}}, {{tz:String}})
            ) + 1
        )
    ),
    daily AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(e.timestamp, {{tz:String}})) AS day,
            COALESCE(sum(
                JSONExtract(e.user_metadata, '_cost', 'amount', 'Float64')
            ), 0) AS costs,
            countDistinct(e.customer_id) + countDistinct(e.external_customer_id) AS active_user_by_event
        FROM events_by_timestamp e
        WHERE e.organization_id IN {{org_ids:Array(String)}}
            AND e.timestamp >= toDateTime({{bounds_start:String}}, {{tz:String}})
            AND e.timestamp <= toDateTime({{bounds_end:String}}, {{tz:String}})
            {customer_filter}
        GROUP BY day
    )
SELECT
    w.window_start AS timestamp,
    COALESCE(d.costs, 0) AS costs,
    COALESCE(sum(d.costs) OVER (ORDER BY w.window_start), 0) AS cumulative_costs,
    COALESCE(d.active_user_by_event, 0) AS active_user_by_event,
    CASE
        WHEN COALESCE(d.active_user_by_event, 0) > 0
        THEN d.costs / d.active_user_by_event
        ELSE 0
    END AS cost_per_user
FROM windows w
LEFT JOIN daily d ON d.day = w.window_start
ORDER BY w.window_start
"""

    return sql, params


async def query_events_metrics(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    bounds_start: datetime | None = None,
    bounds_end: datetime | None = None,
    customer_id: Sequence[UUID] | None = None,
) -> list[dict[str, Any]]:
    sql, params = _build_events_metrics_sql(
        organization_id=organization_id,
        start=start,
        end=end,
        interval=interval,
        timezone=timezone,
        bounds_start=bounds_start,
        bounds_end=bounds_end,
        customer_id=customer_id,
    )
    return await tinybird_client.query(sql, parameters=params, db_statement=sql)


async def query_balance_order_metrics(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    bounds_start: datetime | None = None,
    bounds_end: datetime | None = None,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    sql, params = _build_balance_orders_sql(
        organization_id=organization_id,
        start=start,
        end=end,
        interval=interval,
        timezone=timezone,
        bounds_start=bounds_start,
        bounds_end=bounds_end,
        product_id=product_id,
        customer_id=customer_id,
        billing_type=billing_type,
    )
    return await tinybird_client.query(sql, parameters=params, db_statement=sql)


async def query_mrr_metrics(
    *,
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    now: datetime,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    sql, params = _build_mrr_sql(
        organization_id=organization_id,
        start=start,
        end=end,
        interval=interval,
        timezone=timezone,
        now=now,
        product_id=product_id,
        customer_id=customer_id,
        billing_type=billing_type,
    )
    return await tinybird_client.query(sql, parameters=params, db_statement=sql)

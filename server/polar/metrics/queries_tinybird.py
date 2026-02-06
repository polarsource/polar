from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from polar.integrations.tinybird.client import client as tinybird_client
from polar.kit.time_queries import TimeInterval


class TinybirdQuery(StrEnum):
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


def _build_events_sql(
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

    customer_filter = ""
    if customer_id is not None:
        if "customer_ids" not in params:
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
    sub_state AS (
        SELECT
            subscription_id,
            minMerge(started_at) AS started_at
        FROM subscription_state
        WHERE organization_id IN {{org_ids:Array(String)}}
        GROUP BY subscription_id
        HAVING 1=1
            {sub_product_filter}
    ),
    balance_events AS (
        SELECT
            e.name,
            e.amount,
            e.fee,
            e.subscription_id,
            COALESCE(
                JSONExtract(e.user_metadata, 'order_created_at', 'Nullable(DateTime64(3))'),
                e.timestamp
            ) AS effective_ts,
            ss.started_at AS sub_started_at
        FROM events_by_timestamp AS e FINAL
        LEFT JOIN sub_state ss ON e.subscription_id = ss.subscription_id
        WHERE {event_filters}
            AND e.timestamp >= toDateTime({{buffer_start:String}}, {{tz:String}})
            AND e.timestamp <= toDateTime({{buffer_end:String}}, {{tz:String}})
    ),
    baseline AS (
        SELECT
            COALESCE(sumIf(
                be.amount,
                be.name IN ('balance.order', 'balance.credit_order')
            ), 0) AS hist_revenue,
            COALESCE(
                sum(be.amount) - sum(COALESCE(be.fee, 0)),
                0
            ) AS hist_net_revenue
        FROM balance_events AS be
        WHERE be.effective_ts < toDateTime({{bounds_start:String}}, {{tz:String}})
    ),
    sub_created_daily AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(timestamp, {{tz:String}})) AS day,
            count(DISTINCT subscription_id) AS new_subscriptions
        FROM events_by_timestamp FINAL
        WHERE source = 'system'
            AND name = 'subscription.created'
            AND organization_id IN {{org_ids:Array(String)}}
            -- TODO: investigate whether this should use bounds_start/bounds_end
            -- like the balance order data, instead of the full window range.
            -- Currently matches Postgres behavior which uses the window range.
            AND timestamp >= toDateTime({{start_dt:String}}, {{tz:String}})
            AND timestamp <= toDateTime({{end_dt:String}}, {{tz:String}})
        GROUP BY day
    ),
    daily_balance AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(be.effective_ts, {{tz:String}})) AS day,

            countIf(be.name IN ('balance.order', 'balance.credit_order')) AS orders,

            COALESCE(sumIf(be.amount, be.name IN ('balance.order', 'balance.credit_order')), 0) AS revenue,

            COALESCE(sum(be.amount) - sum(COALESCE(be.fee, 0)), 0) AS net_revenue,

            CASE
                WHEN countIf(be.name IN ('balance.order', 'balance.credit_order')) > 0
                THEN toInt64(ceil(
                    sumIf(be.amount, be.name IN ('balance.order', 'balance.credit_order'))
                    / countIf(be.name IN ('balance.order', 'balance.credit_order'))
                ))
                ELSE 0
            END AS average_order_value,

            CASE
                WHEN countIf(be.name IN ('balance.order', 'balance.credit_order')) > 0
                THEN toInt64(ceil(
                    (sum(be.amount) - sum(COALESCE(be.fee, 0)))
                    / countIf(be.name IN ('balance.order', 'balance.credit_order'))
                ))
                ELSE 0
            END AS net_average_order_value,

            countIf(
                be.name IN ('balance.order', 'balance.credit_order')
                AND be.subscription_id IS NULL
            ) AS one_time_products,

            COALESCE(sumIf(be.amount,
                be.name IN ('balance.order', 'balance.credit_order')
                AND be.subscription_id IS NULL
            ), 0) AS one_time_products_revenue,

            COALESCE(sumIf(be.amount - COALESCE(be.fee, 0),
                be.subscription_id IS NULL
            ), 0) AS one_time_products_net_revenue,

            COALESCE(sumIf(be.amount,
                be.name IN ('balance.order', 'balance.credit_order')
                AND be.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(be.sub_started_at, {{tz:String}})) = day
            ), 0) AS new_subscriptions_revenue,

            COALESCE(sumIf(be.amount - COALESCE(be.fee, 0),
                be.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(be.sub_started_at, {{tz:String}})) = day
            ), 0) AS new_subscriptions_net_revenue,

            countDistinctIf(be.subscription_id,
                be.name IN ('balance.order', 'balance.credit_order')
                AND be.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(be.sub_started_at, {{tz:String}})) != day
            ) AS renewed_subscriptions,

            COALESCE(sumIf(be.amount,
                be.name IN ('balance.order', 'balance.credit_order')
                AND be.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(be.sub_started_at, {{tz:String}})) != day
            ), 0) AS renewed_subscriptions_revenue,

            COALESCE(sumIf(be.amount - COALESCE(be.fee, 0),
                be.subscription_id IS NOT NULL
                AND date_trunc({{iv:String}}, toDateTime(be.sub_started_at, {{tz:String}})) != day
            ), 0) AS renewed_subscriptions_net_revenue

        FROM balance_events AS be
        WHERE be.effective_ts >= toDateTime({{bounds_start:String}}, {{tz:String}})
            AND be.effective_ts <= toDateTime({{bounds_end:String}}, {{tz:String}})
        GROUP BY day
    ),
    daily_events AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(e.timestamp, {{tz:String}})) AS day,
            COALESCE(sum(
                JSONExtract(e.user_metadata, '_cost', 'amount', 'Float64')
            ), 0) AS costs,
            countDistinct(e.customer_id) + countDistinct(e.external_customer_id) AS active_user_by_event
        FROM events_by_timestamp AS e FINAL
        WHERE e.organization_id IN {{org_ids:Array(String)}}
            AND e.timestamp >= toDateTime({{bounds_start:String}}, {{tz:String}})
            AND e.timestamp <= toDateTime({{bounds_end:String}}, {{tz:String}})
            {customer_filter}
        GROUP BY day
    ),
    canceled AS (
        SELECT
            date_trunc({{iv:String}}, toDateTime(e.canceled_at, {{tz:String}})) AS day,
            count(*) AS canceled_subscriptions,
            countIf(e.customer_cancellation_reason = 'customer_service') AS canceled_subscriptions_customer_service,
            countIf(e.customer_cancellation_reason = 'low_quality') AS canceled_subscriptions_low_quality,
            countIf(e.customer_cancellation_reason = 'missing_features') AS canceled_subscriptions_missing_features,
            countIf(e.customer_cancellation_reason = 'switched_service') AS canceled_subscriptions_switched_service,
            countIf(e.customer_cancellation_reason = 'too_complex') AS canceled_subscriptions_too_complex,
            countIf(e.customer_cancellation_reason = 'too_expensive') AS canceled_subscriptions_too_expensive,
            countIf(e.customer_cancellation_reason = 'unused') AS canceled_subscriptions_unused,
            countIf(e.customer_cancellation_reason = 'other' OR e.customer_cancellation_reason IS NULL OR e.customer_cancellation_reason = '') AS canceled_subscriptions_other
        FROM events_by_timestamp AS e FINAL
        WHERE e.source = 'system'
            AND e.name = 'subscription.canceled'
            AND e.organization_id IN {{org_ids:Array(String)}}
            AND e.canceled_at >= toDateTime({{bounds_start:String}}, {{tz:String}})
            AND e.canceled_at <= toDateTime({{bounds_end:String}}, {{tz:String}})
            {customer_filter}
        GROUP BY day
    )
SELECT
    w.window_start AS timestamp,
    COALESCE(db.orders, 0) AS orders,
    COALESCE(db.revenue, 0) AS revenue,
    COALESCE(db.net_revenue, 0) AS net_revenue,
    COALESCE(sum(db.revenue) OVER (ORDER BY w.window_start), 0)
        + b.hist_revenue AS cumulative_revenue,
    COALESCE(sum(db.net_revenue) OVER (ORDER BY w.window_start), 0)
        + b.hist_net_revenue AS net_cumulative_revenue,
    COALESCE(db.average_order_value, 0) AS average_order_value,
    COALESCE(db.net_average_order_value, 0) AS net_average_order_value,
    COALESCE(db.one_time_products, 0) AS one_time_products,
    COALESCE(db.one_time_products_revenue, 0) AS one_time_products_revenue,
    COALESCE(db.one_time_products_net_revenue, 0) AS one_time_products_net_revenue,
    COALESCE(sc.new_subscriptions, 0) AS new_subscriptions,
    COALESCE(db.new_subscriptions_revenue, 0) AS new_subscriptions_revenue,
    COALESCE(db.new_subscriptions_net_revenue, 0) AS new_subscriptions_net_revenue,
    COALESCE(db.renewed_subscriptions, 0) AS renewed_subscriptions,
    COALESCE(db.renewed_subscriptions_revenue, 0) AS renewed_subscriptions_revenue,
    COALESCE(db.renewed_subscriptions_net_revenue, 0) AS renewed_subscriptions_net_revenue,
    COALESCE(de.costs, 0) AS costs,
    COALESCE(sum(de.costs) OVER (ORDER BY w.window_start), 0) AS cumulative_costs,
    COALESCE(de.active_user_by_event, 0) AS active_user_by_event,
    CASE
        WHEN COALESCE(de.active_user_by_event, 0) > 0
        THEN de.costs / de.active_user_by_event
        ELSE 0
    END AS cost_per_user,
    COALESCE(c.canceled_subscriptions, 0) AS canceled_subscriptions,
    COALESCE(c.canceled_subscriptions_customer_service, 0) AS canceled_subscriptions_customer_service,
    COALESCE(c.canceled_subscriptions_low_quality, 0) AS canceled_subscriptions_low_quality,
    COALESCE(c.canceled_subscriptions_missing_features, 0) AS canceled_subscriptions_missing_features,
    COALESCE(c.canceled_subscriptions_switched_service, 0) AS canceled_subscriptions_switched_service,
    COALESCE(c.canceled_subscriptions_too_complex, 0) AS canceled_subscriptions_too_complex,
    COALESCE(c.canceled_subscriptions_too_expensive, 0) AS canceled_subscriptions_too_expensive,
    COALESCE(c.canceled_subscriptions_unused, 0) AS canceled_subscriptions_unused,
    COALESCE(c.canceled_subscriptions_other, 0) AS canceled_subscriptions_other
FROM windows w
LEFT JOIN daily_balance db ON db.day = w.window_start
LEFT JOIN daily_events de ON de.day = w.window_start
LEFT JOIN sub_created_daily sc ON sc.day = w.window_start
LEFT JOIN canceled c ON c.day = w.window_start
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
        sub_customer_filter = "AND customer_id IN {customer_ids:Array(String)}"
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
        HAVING 1=1
            {sub_product_filter}
            {sub_customer_filter}
    ),
    latest_payment AS (
        SELECT
            subscription_id,
            argMax(amount, timestamp) AS settlement_amount
        FROM events_by_timestamp FINAL
        WHERE source = 'system'
            AND name IN ('balance.order', 'balance.credit_order')
            AND organization_id IN {{org_ids:Array(String)}}
            AND subscription_id IS NOT NULL
            {payment_product_filter}
            {payment_customer_filter}
        GROUP BY subscription_id
    ),
    subs_with_mrr AS (
        SELECT
            s.subscription_id,
            s.started_at,
            s.ends_at,
            s.customer_id,
            CASE
                WHEN s.recurring_interval = 'year'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) / (12 * s.recurring_interval_count)))
                WHEN s.recurring_interval = 'month'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) / s.recurring_interval_count))
                WHEN s.recurring_interval = 'week'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 52 / (12 * s.recurring_interval_count)))
                WHEN s.recurring_interval = 'day'
                    THEN toInt64(round(COALESCE(lp.settlement_amount, 0) * 365 / (12 * s.recurring_interval_count)))
                ELSE toInt64(0)
            END AS monthly_amount
        FROM subs s
        LEFT JOIN latest_payment lp ON lp.subscription_id = s.subscription_id
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
    COALESCE(mrr.committed_subscriptions, 0) AS committed_subscriptions,
    COALESCE(churned.churned_subscriptions, 0) AS churned_subscriptions
FROM windows w
LEFT JOIN (
    SELECT
        w2.window_start,
        sum(s.monthly_amount) AS monthly_recurring_revenue,
        sumIf(
            s.monthly_amount,
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
    CROSS JOIN subs_with_mrr s
    WHERE
        (s.started_at IS NULL OR date_trunc({{iv:String}}, toDateTime(s.started_at, {{tz:String}})) <= w2.window_start)
        AND (
            s.ends_at <= toDateTime64(0, 3, 'UTC')
            OR date_trunc({{iv:String}}, toDateTime(s.ends_at, {{tz:String}})) > w2.window_start
        )
    GROUP BY w2.window_start
) mrr ON mrr.window_start = w.window_start
LEFT JOIN (
    SELECT
        date_trunc({{iv:String}}, toDateTime(s.ends_at, {{tz:String}})) AS window_start,
        count(*) AS churned_subscriptions
    FROM subs s
    WHERE s.ends_at > toDateTime64(0, 3, 'UTC')
    GROUP BY window_start
) churned ON churned.window_start = w.window_start
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
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    sql, params = _build_events_sql(
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

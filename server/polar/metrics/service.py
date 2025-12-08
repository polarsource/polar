import uuid
from collections.abc import Sequence
from datetime import date, datetime
from zoneinfo import ZoneInfo

import logfire
from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Organization, User
from polar.models.product import ProductBillingType
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import (
    METRICS,
    METRICS_POST_COMPUTE,
    METRICS_SQL,
    MetaMetric,
    Metric,
    SQLMetric,
)
from .queries import (
    QUERIES,
    QUERY_TO_FUNCTION,
    MetricQuery,
    QueryCallable,
)
from .schemas import MetricsPeriod, MetricsResponse


def _expand_metrics_with_dependencies(
    metrics: Sequence[str] | None,
) -> tuple[set[str], set[str]]:
    """
    Expand metrics to include all dependencies.

    Returns a tuple of:
    - sql_metric_slugs: Set of SQL metric slugs needed (including dependencies)
    - meta_metric_slugs: Set of MetaMetric slugs needed (including dependencies)

    This handles recursive dependencies (e.g., ltv depends on churn_rate which
    depends on other metrics).
    """
    if metrics is None:
        return set(), set()

    sql_metric_slugs: set[str] = set()
    meta_metric_slugs: set[str] = set()

    # Build lookups
    sql_metrics_by_slug = {m.slug: m for m in METRICS_SQL}
    meta_metrics_by_slug = {m.slug: m for m in METRICS_POST_COMPUTE}

    def resolve_dependencies(metric_slug: str, visited: set[str]) -> None:
        """Recursively resolve dependencies for a metric."""
        if metric_slug in visited:
            return
        visited.add(metric_slug)

        # If it's an SQL metric, add it
        if metric_slug in sql_metrics_by_slug:
            sql_metric_slugs.add(metric_slug)
            return

        # If it's a meta metric, add it and resolve its dependencies
        if metric_slug in meta_metrics_by_slug:
            meta_metric_slugs.add(metric_slug)
            meta_cls = meta_metrics_by_slug[metric_slug]
            for dep_slug in getattr(meta_cls, "dependencies", []):
                resolve_dependencies(dep_slug, visited)

    # Resolve dependencies for each requested metric
    for metric_slug in metrics:
        resolve_dependencies(metric_slug, set())

    return sql_metric_slugs, meta_metric_slugs


def _get_required_queries(
    metrics: Sequence[str] | None,
) -> set[MetricQuery] | None:
    """
    Determine which query types are needed based on the requested metrics.

    Returns None if all queries should be executed (backward compatible behavior).
    Returns a set of MetricQuery values if only specific queries are needed.
    """
    if metrics is None:
        return None

    sql_metric_slugs, _ = _expand_metrics_with_dependencies(metrics)

    if not sql_metric_slugs:
        return None

    # Build a lookup for SQL metrics by slug
    sql_metrics_by_slug = {m.slug: m for m in METRICS_SQL}

    required: set[MetricQuery] = set()
    for slug in sql_metric_slugs:
        if slug in sql_metrics_by_slug:
            required.add(sql_metrics_by_slug[slug].query)

    return required if required else None


def _get_filtered_queries(
    required_queries: set[MetricQuery] | None,
) -> list[QueryCallable]:
    """
    Filter the QUERIES list to only include the query functions needed.
    """
    if required_queries is None:
        return list(QUERIES)

    return [
        query_fn
        for query_type, query_fn in QUERY_TO_FUNCTION.items()
        if query_type in required_queries
    ]


def _get_filtered_metrics(
    metrics: Sequence[str] | None,
) -> list[type[SQLMetric]]:
    """
    Filter the METRICS_SQL list to only include the metrics needed.

    This includes both directly requested metrics and their dependencies
    (e.g., gross_margin depends on cumulative_revenue and cumulative_costs).
    """
    if metrics is None:
        return list(METRICS_SQL)

    sql_metric_slugs, _ = _expand_metrics_with_dependencies(metrics)
    return [m for m in METRICS_SQL if m.slug in sql_metric_slugs]


def _get_filtered_post_compute_metrics(
    metrics: Sequence[str] | None,
) -> list[type[MetaMetric]]:
    """
    Filter the METRICS_POST_COMPUTE list to only include the metrics needed.

    This includes both directly requested metrics and their dependencies
    (e.g., ltv depends on churn_rate which is also a MetaMetric).

    The order is preserved from METRICS_POST_COMPUTE to ensure dependencies
    are computed before dependents.
    """
    if metrics is None:
        return list(METRICS_POST_COMPUTE)

    _, meta_metric_slugs = _expand_metrics_with_dependencies(metrics)
    return [m for m in METRICS_POST_COMPUTE if m.slug in meta_metric_slugs]


def _get_filtered_all_metrics(
    metrics: Sequence[str] | None,
) -> list[type[Metric]]:
    """
    Filter the METRICS list to only include the metrics needed.
    """
    if metrics is None:
        return list(METRICS)

    return [m for m in METRICS if m.slug in metrics]


class MetricsService:
    async def get_metrics(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        metrics: Sequence[str] | None = None,
        now: datetime | None = None,
    ) -> MetricsResponse:
        await session.execute(text(f"SET LOCAL TIME ZONE '{timezone.key}'"))
        await session.execute(text("SET LOCAL plan_cache_mode = 'force_custom_plan'"))
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        # Store original bounds before truncation for filtering queries
        original_start_timestamp = start_timestamp
        original_end_timestamp = end_timestamp

        # Truncate start_timestamp to the beginning of the interval period
        # This ensures the timestamp series aligns with how daily metrics are grouped
        if interval == TimeInterval.month:
            start_timestamp = start_timestamp.replace(day=1)
        elif interval == TimeInterval.year:
            start_timestamp = start_timestamp.replace(month=1, day=1)

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        # Determine which queries to run based on metrics
        required_queries = _get_required_queries(metrics)
        filtered_query_fns = _get_filtered_queries(required_queries)
        filtered_metrics_sql = _get_filtered_metrics(metrics)
        filtered_post_compute = _get_filtered_post_compute_metrics(metrics)
        filtered_all_metrics = _get_filtered_all_metrics(metrics)

        with logfire.span(
            "Build metrics query",
            metrics=metrics,
            required_queries=[q.value for q in required_queries]
            if required_queries
            else None,
            num_query_functions=len(filtered_query_fns),
        ):
            queries = [
                query_fn(
                    timestamp_series,
                    interval,
                    auth_subject,
                    filtered_metrics_sql,
                    now or datetime.now(tz=timezone),
                    bounds=(original_start_timestamp, original_end_timestamp),
                    organization_id=organization_id,
                    product_id=product_id,
                    billing_type=billing_type,
                    customer_id=customer_id,
                )
                for query_fn in filtered_query_fns
            ]

        from_query: FromClause = timestamp_series
        for query in queries:
            from_query = from_query.join(
                query,
                onclause=query.c.timestamp == timestamp_column,
            )

        statement = (
            select(
                timestamp_column.label("timestamp"),
                *queries,
            )
            .select_from(from_query)
            .order_by(timestamp_column.asc())
        )

        periods: list[MetricsPeriod] = []
        with logfire.span(
            "Stream and process metrics query",
            start_date=str(start_date),
            end_date=str(end_date),
            metrics=metrics,
        ):
            result = await session.stream(
                statement,
                execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
            )

            row_count = 0
            # Get the set of explicitly requested metric slugs (not dependencies)
            requested_slugs = set(metrics) if metrics else {m.slug for m in METRICS}

            with logfire.span("Fetch and process rows"):
                async for row in result:
                    row_count += 1
                    period_dict = row._asdict()

                    # Compute meta metrics with cascading dependencies
                    # Each metric can depend on previously computed metrics
                    temp_period_dict = dict(period_dict)

                    # Initialize all computed metrics to 0 first to satisfy Pydantic schema
                    for meta_metric in filtered_post_compute:
                        temp_period_dict[meta_metric.slug] = 0

                    # Now compute each metric, updating the dict as we go
                    # This allows later metrics to depend on earlier computed metrics
                    for meta_metric in filtered_post_compute:
                        temp_period = MetricsPeriod.model_validate(temp_period_dict)
                        computed_value = meta_metric.compute_from_period(temp_period)
                        temp_period_dict[meta_metric.slug] = computed_value
                        period_dict[meta_metric.slug] = computed_value

                    # Filter to only include explicitly requested metrics (not dependencies)
                    # Always include timestamp
                    filtered_period_dict = {
                        k: v
                        for k, v in period_dict.items()
                        if k == "timestamp" or k in requested_slugs
                    }

                    periods.append(MetricsPeriod.model_validate(filtered_period_dict))

            logfire.info("Processed {row_count} rows", row_count=row_count)

        totals: dict[str, int | float] = {}
        with logfire.span(
            "Get cumulative metrics",
            start_date=str(start_date),
            end_date=str(end_date),
        ):
            for metric in filtered_all_metrics:
                totals[metric.slug] = metric.get_cumulative(periods)

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in filtered_all_metrics},
            }
        )


metrics = MetricsService()

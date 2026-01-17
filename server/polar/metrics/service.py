import uuid
from collections.abc import Sequence
from datetime import date, datetime
from zoneinfo import ZoneInfo

import logfire
from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject, is_organization
from polar.config import settings
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Organization, User
from polar.models.product import ProductBillingType
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import (
    METRICS,
    METRICS_POST_COMPUTE,
    METRICS_SQL,
    METRICS_SQL_SETTLEMENT,
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


def _get_required_queries_settlement(
    metrics: Sequence[str] | None,
) -> set[MetricQuery] | None:
    """
    Determine which query types are needed for settlement currency metrics.
    Uses settlement metrics for metrics that have settlement versions,
    regular metrics for everything else.
    """
    if metrics is None:
        return None

    sql_metric_slugs, _ = _expand_metrics_with_dependencies(metrics)

    if not sql_metric_slugs:
        return None

    settlement_metrics_by_slug = {m.slug: m for m in METRICS_SQL_SETTLEMENT}
    sql_metrics_by_slug = {m.slug: m for m in METRICS_SQL}

    required: set[MetricQuery] = set()
    for slug in sql_metric_slugs:
        if slug in settlement_metrics_by_slug:
            required.add(settlement_metrics_by_slug[slug].query)
        elif slug in sql_metrics_by_slug:
            required.add(sql_metrics_by_slug[slug].query)

    return required if required else None


def _get_filtered_queries_settlement(
    required_queries: set[MetricQuery] | None,
) -> list[QueryCallable]:
    """
    Filter queries for settlement currency mode.
    Uses balance_orders query instead of orders query.
    Uses settlement_active_subscriptions for settlement MRR metrics.
    """
    if required_queries is None:
        queries_to_include = {
            MetricQuery.balance_orders,
            MetricQuery.active_subscriptions,
            MetricQuery.settlement_active_subscriptions,
            MetricQuery.checkouts,
            MetricQuery.canceled_subscriptions,
            MetricQuery.churned_subscriptions,
            MetricQuery.events,
        }
    else:
        queries_to_include = set()
        for q in required_queries:
            if q == MetricQuery.orders:
                queries_to_include.add(MetricQuery.balance_orders)
            else:
                queries_to_include.add(q)

    return [
        query_fn
        for query_type, query_fn in QUERY_TO_FUNCTION.items()
        if query_type in queries_to_include
    ]


def _get_filtered_metrics_settlement(
    metrics: Sequence[str] | None,
) -> list[type[SQLMetric]]:
    """
    Filter metrics for settlement currency mode.
    Uses settlement metrics for order-based metrics, regular metrics for everything else.
    """
    settlement_slugs = {m.slug for m in METRICS_SQL_SETTLEMENT}
    non_order_metrics = [m for m in METRICS_SQL if m.query != MetricQuery.orders]

    if metrics is None:
        return list(METRICS_SQL_SETTLEMENT) + non_order_metrics

    sql_metric_slugs, _ = _expand_metrics_with_dependencies(metrics)

    result: list[type[SQLMetric]] = []
    for slug in sql_metric_slugs:
        if slug in settlement_slugs:
            metric = next((m for m in METRICS_SQL_SETTLEMENT if m.slug == slug), None)
            if metric:
                result.append(metric)
        else:
            metric = next((m for m in METRICS_SQL if m.slug == slug), None)
            if metric:
                result.append(metric)

    return result


class MetricsService:
    async def _should_use_settlement_metrics(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[uuid.UUID] | None,
    ) -> bool:
        """
        Check if settlement currency metrics should be used based on organization feature flag.
        Returns True only if ALL relevant organizations have the feature enabled.

        If organization_id is specified, checks those organizations.
        Otherwise, derives the organization from auth_subject.
        """
        repo = OrganizationRepository.from_session(session)

        org_ids_to_check: list[uuid.UUID] = []

        if organization_id is not None and len(organization_id) > 0:
            org_ids_to_check = list(organization_id)
        elif is_organization(auth_subject):
            org_ids_to_check = [auth_subject.subject.id]
        else:
            return False

        for org_id in org_ids_to_check:
            org = await repo.get_by_id(org_id)
            if org is None:
                return False
            if not org.feature_settings.get("settlement_currency_metrics", False):
                return False

        return True

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

        # Check if settlement currency metrics should be used
        use_settlement_metrics = await self._should_use_settlement_metrics(
            session, auth_subject, organization_id
        )

        # Determine which queries to run based on metrics
        if use_settlement_metrics:
            required_queries = _get_required_queries_settlement(metrics)
            filtered_query_fns = _get_filtered_queries_settlement(required_queries)
            filtered_metrics_sql = _get_filtered_metrics_settlement(metrics)
        else:
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

import math
import uuid
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import logfire
import structlog
from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.config import settings
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.product import ProductBillingType
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import (
    METRICS,
    METRICS_POST_COMPUTE,
    METRICS_SQL,
    METRICS_TINYBIRD_SETTLEMENT,
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
from .queries_tinybird import (
    query_metrics,
)
from .schemas import MetricsPeriod, MetricsResponse

log = structlog.get_logger()


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


def _metric_values_match(pg_val: int | float, tb_val: int | float) -> bool:
    if pg_val == tb_val:
        return True

    if isinstance(pg_val, bool) or isinstance(tb_val, bool):
        return False

    if isinstance(pg_val, float) or isinstance(tb_val, float):
        return math.isclose(float(pg_val), float(tb_val), rel_tol=1e-12, abs_tol=1e-12)

    return False


def _truncate_to_interval(timestamp: datetime, interval: TimeInterval) -> datetime:
    if interval == TimeInterval.hour:
        return timestamp.replace(minute=0, second=0, microsecond=0)
    if interval == TimeInterval.day:
        return timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == TimeInterval.week:
        start = timestamp - timedelta(days=timestamp.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == TimeInterval.month:
        return timestamp.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if interval == TimeInterval.year:
        return timestamp.replace(
            month=1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
    return timestamp


def _is_current_period(
    period_timestamp: datetime,
    *,
    timezone: ZoneInfo,
    interval: TimeInterval,
    now: datetime,
) -> bool:
    period_local = (
        period_timestamp.replace(tzinfo=timezone)
        if period_timestamp.tzinfo is None
        else period_timestamp.astimezone(timezone)
    )
    now_local = now.astimezone(timezone)
    return _truncate_to_interval(period_local, interval) == _truncate_to_interval(
        now_local, interval
    )


class MetricsService:
    async def _get_tinybird_enabled_org(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[uuid.UUID] | None,
    ) -> Organization | None:
        if not settings.TINYBIRD_EVENTS_READ:
            return None

        org: Organization | None
        if is_organization(auth_subject):
            org = auth_subject.subject
        elif is_user(auth_subject):
            if not organization_id:
                return None
            statement = select(Organization).where(
                Organization.id == organization_id[0],
                Organization.id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                ),
            )
            result = await session.execute(statement)
            org = result.scalar_one_or_none()
            if org is None:
                return None
        else:
            return None

        if org.feature_settings.get("tinybird_read", False) or org.feature_settings.get(
            "tinybird_compare", True
        ):
            return org

        return None

    async def _get_metrics_from_tinybird(
        self,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        original_start_timestamp: datetime,
        original_end_timestamp: datetime,
        timezone: ZoneInfo,
        interval: TimeInterval,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        metrics: Sequence[str] | None = None,
        now: datetime | None = None,
    ) -> MetricsResponse:
        now_dt = now or datetime.now(tz=timezone)
        tb_slugs = {m.slug for m in METRICS_TINYBIRD_SETTLEMENT}

        org_ids: list[uuid.UUID] = []
        if organization_id is not None and len(organization_id) > 0:
            org_ids = list(organization_id)
        elif is_organization(auth_subject):
            org_ids = [auth_subject.subject.id]

        if metrics is not None:
            expanded_sql_slugs, _ = _expand_metrics_with_dependencies(metrics)
            tb_needed = {s for s in expanded_sql_slugs if s in tb_slugs}
        else:
            tb_needed = tb_slugs

        if not tb_needed or not org_ids:
            return MetricsResponse.model_validate(
                {"periods": [], "totals": {}, "metrics": {}}
            )

        tb_queries = list(
            {m.query for m in METRICS_TINYBIRD_SETTLEMENT if m.slug in tb_needed}
        )
        billing_strs = [bt.value for bt in billing_type] if billing_type else None

        with logfire.span(
            "Execute Tinybird metric queries",
            queries=[q.value for q in tb_queries],
        ):
            tb_rows = await query_metrics(
                metric_types=tb_queries,
                organization_id=org_ids,
                start=start_timestamp,
                end=end_timestamp,
                interval=interval,
                timezone=timezone.key,
                bounds_start=original_start_timestamp,
                bounds_end=original_end_timestamp,
                now=now_dt,
                product_id=product_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                billing_type=billing_strs,
            )

        periods: list[MetricsPeriod] = []
        for row in tb_rows:
            ts = row.get("timestamp")
            if isinstance(ts, str):
                row["timestamp"] = datetime.fromisoformat(ts).replace(tzinfo=timezone)
            elif isinstance(ts, date) and not isinstance(ts, datetime):
                row["timestamp"] = datetime(ts.year, ts.month, ts.day, tzinfo=timezone)
            elif isinstance(ts, datetime) and ts.tzinfo is None:
                row["timestamp"] = ts.replace(tzinfo=timezone)

            filtered = {
                k: v for k, v in row.items() if k == "timestamp" or k in tb_needed
            }
            periods.append(MetricsPeriod.model_validate(filtered))

        tb_by_slug = {m.slug: m for m in METRICS_TINYBIRD_SETTLEMENT}
        tb_metrics = [tb_by_slug[s] for s in tb_needed if s in tb_by_slug]

        totals: dict[str, int | float] = {}
        for metric in tb_metrics:
            totals[metric.slug] = metric.get_cumulative(periods)

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in tb_metrics},
            }
        )

    def _log_tinybird_comparison(
        self,
        organization_id: uuid.UUID,
        pg_response: MetricsResponse,
        tb_response: MetricsResponse,
        *,
        interval: TimeInterval,
        timezone: ZoneInfo,
        now: datetime,
    ) -> None:
        tb_slugs = {m.slug for m in METRICS_TINYBIRD_SETTLEMENT}
        mismatches: list[dict[str, object]] = []
        revenue_mismatches: list[dict[str, object]] = []

        for i, (pg_period, tb_period) in enumerate(
            zip(pg_response.periods, tb_response.periods)
        ):
            if _is_current_period(
                pg_period.timestamp, interval=interval, timezone=timezone, now=now
            ):
                continue

            for slug in tb_slugs:
                pg_val = getattr(pg_period, slug, None)
                tb_val = getattr(tb_period, slug, None)
                if (
                    pg_val is not None
                    and tb_val is not None
                    and not _metric_values_match(pg_val, tb_val)
                ):
                    mismatch_obj = {
                        "period": i,
                        "timestamp": str(pg_period.timestamp),
                        "slug": slug,
                        "pg": pg_val,
                        "tinybird": tb_val,
                    }
                    if slug in [
                        "average_revenue_per_user",
                        "monthly_recurring_revenue",
                        "committed_monthly_recurring_revenue",
                        "ltv",
                    ]:
                        revenue_mismatches.append(mismatch_obj)
                    else:
                        mismatches.append(mismatch_obj)

        with logfire.span(
            "tinybird.metrics.shadow.comparison",
            organization_id=str(organization_id),
            pg_periods=len(pg_response.periods),
            tb_periods=len(tb_response.periods),
            has_diff=len(mismatches) > 0 or len(revenue_mismatches) > 0,
            mismatches=mismatches,
            mismatch_count=len(mismatches),
            revenue_mismatches=revenue_mismatches,
            revenue_mismatch_count=len(revenue_mismatches),
        ):
            pass

    def _merge_tinybird_over_pg(
        self,
        pg_response: MetricsResponse,
        tb_response: MetricsResponse,
        metrics: Sequence[str] | None = None,
    ) -> MetricsResponse:
        tb_slugs = {m.slug for m in METRICS_TINYBIRD_SETTLEMENT}
        filtered_post_compute = _get_filtered_post_compute_metrics(metrics)
        requested_slugs = (
            set(metrics) if metrics else {m.slug for m in METRICS} | tb_slugs
        )

        periods: list[MetricsPeriod] = []
        tb_periods_map = {p.timestamp: p for p in tb_response.periods}

        for pg_period in pg_response.periods:
            period_dict = pg_period.model_dump()
            tb_period = tb_periods_map.get(pg_period.timestamp)
            if tb_period is not None:
                for slug in tb_slugs:
                    tb_val = getattr(tb_period, slug, None)
                    if tb_val is not None:
                        period_dict[slug] = tb_val

            temp_dict = dict(period_dict)
            for meta_metric in filtered_post_compute:
                temp_dict[meta_metric.slug] = 0
            for meta_metric in filtered_post_compute:
                temp_period = MetricsPeriod.model_validate(temp_dict)
                computed = meta_metric.compute_from_period(temp_period)
                temp_dict[meta_metric.slug] = computed
                period_dict[meta_metric.slug] = computed

            filtered = {
                k: v
                for k, v in period_dict.items()
                if k == "timestamp" or k in requested_slugs
            }
            periods.append(MetricsPeriod.model_validate(filtered))

        tb_by_slug = {m.slug: m for m in METRICS_TINYBIRD_SETTLEMENT}
        sql_by_slug = {m.slug: m for m in METRICS_SQL}
        meta_by_slug = {m.slug: m for m in METRICS_POST_COMPUTE}
        all_metrics: list[type[Metric]] = []
        for slug in requested_slugs:
            if slug in tb_by_slug:
                all_metrics.append(tb_by_slug[slug])
            elif slug in meta_by_slug:
                all_metrics.append(meta_by_slug[slug])
            elif slug in sql_by_slug:
                all_metrics.append(sql_by_slug[slug])

        totals: dict[str, int | float] = {}
        for metric in all_metrics:
            totals[metric.slug] = metric.get_cumulative(periods)

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in all_metrics},
            }
        )

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
        if interval == TimeInterval.week:
            start_timestamp -= timedelta(days=start_timestamp.weekday())
        elif interval == TimeInterval.month:
            start_timestamp = start_timestamp.replace(day=1)
        elif interval == TimeInterval.year:
            start_timestamp = start_timestamp.replace(month=1, day=1)

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        # Determine which queries to run based on metrics
        now_dt = now or datetime.now(tz=timezone)

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
                    now_dt,
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

        pg_response = MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in filtered_all_metrics},
            }
        )

        org = await self._get_tinybird_enabled_org(
            session, auth_subject, organization_id
        )
        if org is None:
            return pg_response

        tinybird_compare = org.feature_settings.get("tinybird_compare", False)
        tinybird_read = org.feature_settings.get("tinybird_read", True)

        external_customer_id: list[str] | None = None
        if customer_id is not None:
            customer_stmt = select(Customer.external_id).where(
                Customer.id.in_(customer_id),
                Customer.external_id.is_not(None),
                Customer.external_id != "",
            )
            external_ids = [eid for eid in await session.scalars(customer_stmt) if eid]
            if external_ids:
                external_customer_id = external_ids

        tb_product_id = product_id
        if billing_type is not None:
            product_stmt = select(Product.id).where(
                Product.organization_id == org.id,
                Product.billing_type.in_(billing_type),
                Product.is_deleted.is_(False),
            )
            billing_type_product_ids = list(await session.scalars(product_stmt))
            if product_id is not None:
                tb_product_id = [
                    pid for pid in product_id if pid in billing_type_product_ids
                ]
            else:
                tb_product_id = billing_type_product_ids

        try:
            tb_response = await self._get_metrics_from_tinybird(
                auth_subject,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                original_start_timestamp=original_start_timestamp,
                original_end_timestamp=original_end_timestamp,
                timezone=timezone,
                interval=interval,
                organization_id=organization_id,
                product_id=tb_product_id,
                billing_type=billing_type,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                metrics=metrics,
                now=now_dt,
            )
        except Exception as e:
            log.error(
                "tinybird.metrics.query.failed",
                organization_id=str(org.id),
                error=str(e),
            )
            return pg_response

        if tinybird_compare:
            self._log_tinybird_comparison(
                org.id,
                pg_response,
                tb_response,
                interval=interval,
                timezone=timezone,
                now=now_dt,
            )
            return pg_response

        if tinybird_read:
            return self._merge_tinybird_over_pg(pg_response, tb_response, metrics)

        return pg_response


metrics = MetricsService()

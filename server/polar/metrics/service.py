import asyncio
import uuid
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import logfire
from sqlalchemy import ColumnElement, FromClause, select, text

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.config import settings
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.product import ProductBillingType
from polar.postgres import AsyncReadSession, AsyncSession

from .metrics import (
    METRICS,
    METRICS_PG_ONLY,
    METRICS_POST_COMPUTE,
    METRICS_TINYBIRD_SETTLEMENT,
    SQLMetric,
)
from .queries import (
    QUERY_TO_FUNCTION,
    QueryCallable,
)
from .queries_tinybird import (
    TinybirdQuery,
    query_metrics,
)
from .schemas import MetricsPeriod, MetricsResponse


def _expand_metrics_with_dependencies(
    metrics: Sequence[str] | None,
) -> tuple[set[str], set[str], set[str]]:
    """
    Expand metrics to include all dependencies.

    Returns a tuple of:
    - pg_slugs: Set of PG-only metric slugs needed
    - tb_slugs: Set of Tinybird metric slugs needed
    - meta_slugs: Set of MetaMetric slugs needed
    """
    pg_by_slug = {m.slug: m for m in METRICS_PG_ONLY}
    tb_by_slug = {m.slug: m for m in METRICS_TINYBIRD_SETTLEMENT}
    meta_by_slug = {m.slug: m for m in METRICS_POST_COMPUTE}

    if metrics is None:
        return set(pg_by_slug), set(tb_by_slug), set(meta_by_slug)

    pg_slugs: set[str] = set()
    tb_slugs: set[str] = set()
    meta_slugs: set[str] = set()

    def resolve(slug: str, visited: set[str]) -> None:
        if slug in visited:
            return
        visited.add(slug)

        if slug in pg_by_slug:
            pg_slugs.add(slug)
        elif slug in tb_by_slug:
            tb_slugs.add(slug)
        elif slug in meta_by_slug:
            meta_slugs.add(slug)
            for dep in getattr(meta_by_slug[slug], "dependencies", []):
                resolve(dep, visited)

    for metric_slug in metrics:
        resolve(metric_slug, set())

    return pg_slugs, tb_slugs, meta_slugs


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
        if interval == TimeInterval.week:
            start_timestamp -= timedelta(days=start_timestamp.weekday())
        elif interval == TimeInterval.month:
            start_timestamp = start_timestamp.replace(day=1)
        elif interval == TimeInterval.year:
            start_timestamp = start_timestamp.replace(month=1, day=1)

        now_dt = now or datetime.now(tz=timezone)

        pg_slugs, tb_slugs, meta_slugs = _expand_metrics_with_dependencies(metrics)

        filtered_pg_metrics = [m for m in METRICS_PG_ONLY if m.slug in pg_slugs]
        filtered_tb_metrics = [
            m for m in METRICS_TINYBIRD_SETTLEMENT if m.slug in tb_slugs
        ]
        filtered_post_compute = [
            m for m in METRICS_POST_COMPUTE if m.slug in meta_slugs
        ]
        filtered_all_metrics = [m for m in METRICS if m.slug in metrics] if metrics else list(METRICS)
        required_queries = {m.query for m in filtered_pg_metrics}
        pg_query_fns: list[QueryCallable] = [
            fn for qt, fn in QUERY_TO_FUNCTION.items() if qt in required_queries
        ]

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

        tb_org_ids = await self._resolve_tb_org_ids(
            session, auth_subject, organization_id=organization_id
        )

        tb_product_id = product_id
        if billing_type is not None and tb_org_ids:
            product_stmt = select(Product.id).where(
                Product.organization_id.in_(tb_org_ids),
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

        tb_customer_ids = await self._resolve_tb_customer_ids(
            session,
            tb_org_ids=tb_org_ids,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            tb_needed=tb_slugs,
        )

        pg_coro = self._get_metrics_from_pg(
            session,
            auth_subject,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            original_start_timestamp=original_start_timestamp,
            original_end_timestamp=original_end_timestamp,
            interval=interval,
            organization_id=organization_id,
            product_id=product_id,
            billing_type=billing_type,
            customer_id=customer_id,
            query_fns=pg_query_fns,
            pg_metrics=filtered_pg_metrics,
            now=now_dt,
        )

        tb_coro = self._get_metrics_from_tinybird(
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            original_start_timestamp=original_start_timestamp,
            original_end_timestamp=original_end_timestamp,
            timezone=timezone,
            interval=interval,
            tb_org_ids=tb_org_ids,
            product_id=tb_product_id,
            billing_type=billing_type,
            tb_customer_ids=tb_customer_ids,
            external_customer_id=external_customer_id,
            tb_needed=tb_slugs,
        )

        pg_periods, tb_periods = await asyncio.gather(pg_coro, tb_coro)

        periods: list[MetricsPeriod] = []
        all_timestamps = sorted(set(pg_periods.keys()) | set(tb_periods.keys()))

        for ts in all_timestamps:
            period_dict: dict[str, object] = {"timestamp": ts}

            pg_period = pg_periods.get(ts)
            if pg_period is not None:
                for pg_m in filtered_pg_metrics:
                    period_dict[pg_m.slug] = getattr(pg_period, pg_m.slug, None)

            tb_period = tb_periods.get(ts)
            if tb_period is not None:
                for tb_m in filtered_tb_metrics:
                    period_dict[tb_m.slug] = getattr(tb_period, tb_m.slug, None)

            temp_dict = dict(period_dict)
            for meta_metric in filtered_post_compute:
                temp_dict[meta_metric.slug] = 0
            for meta_metric in filtered_post_compute:
                temp_period = MetricsPeriod.model_validate(temp_dict)
                computed = meta_metric.compute_from_period(temp_period)
                temp_dict[meta_metric.slug] = computed
                period_dict[meta_metric.slug] = computed

            if metrics is not None:
                requested = set(metrics)
                period_dict = {
                    k: v
                    for k, v in period_dict.items()
                    if k == "timestamp" or k in requested
                }

            periods.append(MetricsPeriod.model_validate(period_dict))

        totals: dict[str, int | float] = {}
        for metric in filtered_all_metrics:
            totals[metric.slug] = metric.get_cumulative(periods)

        return MetricsResponse.model_validate(
            {
                "periods": periods,
                "totals": totals,
                "metrics": {m.slug: m for m in filtered_all_metrics},
            }
        )

    async def _get_metrics_from_pg(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        original_start_timestamp: datetime,
        original_end_timestamp: datetime,
        interval: TimeInterval,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        query_fns: list[QueryCallable],
        pg_metrics: list[type[SQLMetric]],
        now: datetime | None = None,
    ) -> dict[datetime, MetricsPeriod]:
        if not query_fns:
            return {}

        now_dt = now or datetime.now(tz=start_timestamp.tzinfo or ZoneInfo("UTC"))

        timestamp_series = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )
        timestamp_column: ColumnElement[datetime] = timestamp_series.c.timestamp

        with logfire.span(
            "Build PG metrics query",
            num_query_functions=len(query_fns),
        ):
            queries = [
                query_fn(
                    timestamp_series,
                    interval,
                    auth_subject,
                    pg_metrics,
                    now_dt,
                    bounds=(original_start_timestamp, original_end_timestamp),
                    organization_id=organization_id,
                    product_id=product_id,
                    billing_type=billing_type,
                    customer_id=customer_id,
                )
                for query_fn in query_fns
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

        periods: dict[datetime, MetricsPeriod] = {}
        with logfire.span("Stream PG metrics query"):
            result = await session.stream(
                statement,
                execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
            )
            async for row in result:
                period = MetricsPeriod.model_validate(row._asdict())
                periods[period.timestamp] = period

        return periods

    async def _resolve_tb_org_ids(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
    ) -> list[uuid.UUID]:
        if organization_id is not None and len(organization_id) > 0:
            return list(organization_id)
        if is_organization(auth_subject):
            return [auth_subject.subject.id]
        if is_user(auth_subject):
            stmt = select(UserOrganization.organization_id).where(
                UserOrganization.user_id == auth_subject.subject.id,
                UserOrganization.is_deleted.is_(False),
            )
            return list(await session.scalars(stmt))
        return []

    async def _resolve_tb_customer_ids(
        self,
        session: AsyncSession | AsyncReadSession,
        *,
        tb_org_ids: list[uuid.UUID],
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        tb_needed: set[str],
    ) -> list[uuid.UUID] | None:
        tb_queries = list(
            {m.query for m in METRICS_TINYBIRD_SETTLEMENT if m.slug in tb_needed}
        )

        result: list[uuid.UUID] | None = (
            list(customer_id) if customer_id is not None else None
        )
        if (
            TinybirdQuery.cancellations in tb_queries
            and external_customer_id is not None
            and len(external_customer_id) > 0
            and tb_org_ids
        ):
            stmt = select(Customer.id).where(
                Customer.organization_id.in_(tb_org_ids),
                Customer.external_id.in_(external_customer_id),
            )
            resolved = list(await session.scalars(stmt))
            merged = list(result or [])
            merged.extend(resolved)
            if merged:
                result = list(dict.fromkeys(merged))
        return result

    async def _get_metrics_from_tinybird(
        self,
        *,
        start_timestamp: datetime,
        end_timestamp: datetime,
        original_start_timestamp: datetime,
        original_end_timestamp: datetime,
        timezone: ZoneInfo,
        interval: TimeInterval,
        tb_org_ids: list[uuid.UUID],
        product_id: Sequence[uuid.UUID] | None = None,
        billing_type: Sequence[ProductBillingType] | None = None,
        tb_customer_ids: list[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        tb_needed: set[str],
    ) -> dict[datetime, MetricsPeriod]:
        if not tb_needed or not tb_org_ids:
            return {}

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
                organization_id=tb_org_ids,
                start=start_timestamp,
                end=end_timestamp,
                interval=interval,
                timezone=timezone.key,
                bounds_start=original_start_timestamp,
                bounds_end=original_end_timestamp,
                product_id=product_id,
                customer_id=tb_customer_ids,
                external_customer_id=external_customer_id,
                billing_type=billing_strs,
            )

        periods: dict[datetime, MetricsPeriod] = {}
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
            period = MetricsPeriod.model_validate(filtered)
            periods[period.timestamp] = period

        return periods


metrics = MetricsService()

import uuid
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import cast
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.event.service import event as event_service
from polar.kit.currency import get_presentment_currency
from polar.kit.time_queries import TimeInterval
from polar.logging import Logger
from polar.metrics.aggregation import latest
from polar.metrics.schemas import MetricsResponse
from polar.metrics.service import metrics as metrics_service
from polar.models import Product
from polar.models.product_price import ProductPriceFixed
from polar.order.repository import OrderRepository
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository

from .detectors import DETECTORS, Detector, DetectorContext
from .schemas import (
    ConfidenceLevel,
    Insight,
    InsightCategory,
    InsightSeverity,
)
from .signals import (
    CUSTOMER_COSTS_SAMPLE_LIMIT,
    ChurnBreakdown,
    CurrencyOpportunitySignal,
    CustomerCostSignal,
    ProductPricing,
)

log: Logger = structlog.get_logger()

# Windows for the churn-breakdown and currency-opportunity prefetches.
_CHURN_BREAKDOWN_WINDOW_DAYS = 30
_CURRENCY_WINDOW_DAYS = 30

# Extra days beyond the longest detector lookback so a `value_n_periods_ago`
# baseline is always present in the fetched series.
_LOOKBACK_HEADROOM_DAYS = 5

# Per-product metrics cost one metrics query each; cap how many products the
# per-product detectors read so the feed stays a bounded number of queries.
_MAX_PRODUCTS = 8

# Cost events are attributed to customers, not products (the Tinybird costs
# pipe has no product filter), so per-product cost reads go through the
# product's active-customer cohort as a `customer_id` filter. The filter is a
# GET query param, which bounds how many customer UUIDs fit in the URL —
# products with a larger cohort are skipped (their margin needs a dedicated
# product-attributed pipe) rather than silently sampled.
_MAX_COHORT_CUSTOMERS = 150

# Per-customer cost ranking window for concentration detectors. The fetch
# depth is CUSTOMER_COSTS_SAMPLE_LIMIT so confidence tiers aren't capped by
# a truncated ranking.
_CUSTOMER_COSTS_WINDOW_DAYS = 30

# What the merchant should care about most, first. Detector priority and
# confidence only break ties within a severity band.
_SEVERITY_RANK: dict[InsightSeverity, int] = {
    InsightSeverity.critical: 0,
    InsightSeverity.warning: 1,
    InsightSeverity.opportunity: 2,
    InsightSeverity.info: 3,
}

_CONFIDENCE_RANK: dict[ConfidenceLevel, int] = {
    ConfidenceLevel.high: 0,
    ConfidenceLevel.medium: 1,
    ConfidenceLevel.low: 2,
}


class CompassService:
    async def list_insights(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        timezone: ZoneInfo,
        organization_id: Sequence[uuid.UUID] | None = None,
        category: Sequence[InsightCategory] | None = None,
        now: datetime | None = None,
        redis: Redis | None = None,
    ) -> list[Insight]:
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.analytics_read
        )
        if organization_id is not None:
            org_ids = {oid for oid in org_ids if oid in set(organization_id)}
        # Compass is gated per organization by the `compass_enabled` feature flag.
        org_ids = await self._compass_enabled_org_ids(session, org_ids)
        detectors = self._select_detectors(category)
        if not org_ids or not detectors:
            return []

        today = (now or datetime.now(tz=timezone)).astimezone(timezone).date()
        # One window serves every detector: the union of their slugs over the
        # longest lookback, fetched once per organization.
        slugs = sorted({slug for d in detectors for slug in d.metric_slugs})
        days = max(d.lookback_days for d in detectors) + _LOOKBACK_HEADROOM_DAYS

        # Organizations are processed serially on purpose: the session (and its
        # `SET LOCAL` connection state inside the metrics service) must not be
        # used concurrently.
        insights: list[Insight] = []
        for org_id in org_ids:
            try:
                response = await metrics_service.get_metrics(
                    session,
                    auth_subject,
                    start_date=today - timedelta(days=days),
                    end_date=today,
                    timezone=timezone,
                    interval=TimeInterval.day,
                    organization_id=[org_id],
                    metrics=slugs,
                    redis=redis,
                )
            except Exception:
                # One organization's metrics failing shouldn't blank the feed.
                log.exception("compass.metrics_error", organization_id=str(org_id))
                continue

            products = await self._product_pricing(
                session,
                auth_subject,
                org_id,
                detectors,
                org_metrics=response,
                today=today,
                timezone=timezone,
                days=days,
                redis=redis,
            )
            customer_costs = await self._customer_costs(
                session,
                auth_subject,
                org_id,
                detectors,
                today=today,
                timezone=timezone,
            )
            churn_breakdown = await self._churn_breakdown(
                session, org_id, detectors, today=today, timezone=timezone
            )
            currency_signals = await self._currency_signals(
                session, org_id, detectors, today=today, timezone=timezone
            )
            ctx = DetectorContext(
                organization_id=org_id,
                timezone=timezone,
                today=today,
                metrics=response,
                products=products,
                customer_costs=customer_costs,
                churn_breakdown=churn_breakdown,
                currency_signals=currency_signals,
            )
            for detector in detectors:
                try:
                    insight = detector.evaluate(ctx)
                except Exception:
                    # A broken detector drops its own card, not the feed.
                    log.exception(
                        "compass.detector_error",
                        detector_id=detector.id,
                        organization_id=str(org_id),
                    )
                    continue
                if insight is not None:
                    insights.append(insight)

        if not insights:
            return []

        priority: dict[str, int] = {d.id: d.priority for d in detectors}
        insights.sort(
            key=lambda i: (
                _SEVERITY_RANK[i.severity],
                priority[i.detector_id],
                _CONFIDENCE_RANK[i.confidence],
            )
        )
        return insights

    async def _product_pricing(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        org_id: uuid.UUID,
        detectors: Sequence[Detector],
        *,
        org_metrics: MetricsResponse,
        today: date,
        timezone: ZoneInfo,
        days: int,
        redis: Redis | None,
    ) -> list[ProductPricing]:
        """Per-product pricing + metrics for detectors that declare a need.

        Skipped entirely unless a selected detector declares
        `product_metric_slugs` AND the organization emits cost data — the
        org-level gross margin reading 0 means no costs were ingested, so
        per-product margins would be meaningless (and N wasted queries).
        """
        slugs = sorted({s for d in detectors for s in d.product_metric_slugs})
        if not slugs:
            return []
        if latest(org_metrics, "gross_margin_percentage") <= 0:
            return []

        repository = ProductRepository.from_session(session)
        products = await repository.get_all_by_organization(
            org_id,
            options=(selectinload(Product.all_prices),),
            limit=_MAX_PRODUCTS,
        )

        subscription_repository = SubscriptionRepository.from_session(session)
        pricing: list[ProductPricing] = []
        for product in products:
            price = next(
                (
                    p
                    for p in product.all_prices
                    if isinstance(p, ProductPriceFixed)
                    and not p.is_archived
                    and p.price_amount
                ),
                None,
            )
            if price is None:
                continue
            # Cost attribution goes through the product's active-customer
            # cohort: revenue is filtered by product, costs by these customers
            # (see _MAX_COHORT_CUSTOMERS). Fetch one past the cap to detect
            # oversized cohorts and skip them instead of mis-sampling.
            cohort = list(
                await subscription_repository.get_active_customer_ids_by_product(
                    product.id, limit=_MAX_COHORT_CUSTOMERS + 1
                )
            )
            if not cohort:
                continue
            if len(cohort) > _MAX_COHORT_CUSTOMERS:
                log.warning(
                    "compass.product_cohort_too_large",
                    organization_id=str(org_id),
                    product_id=str(product.id),
                    cap=_MAX_COHORT_CUSTOMERS,
                )
                continue
            try:
                response = await metrics_service.get_metrics(
                    session,
                    auth_subject,
                    start_date=today - timedelta(days=days),
                    end_date=today,
                    timezone=timezone,
                    interval=TimeInterval.day,
                    organization_id=[org_id],
                    product_id=[product.id],
                    customer_id=cohort,
                    metrics=slugs,
                    redis=redis,
                )
            except Exception:
                # One product's metrics failing shouldn't drop the others.
                log.exception(
                    "compass.product_metrics_error",
                    organization_id=str(org_id),
                    product_id=str(product.id),
                )
                continue
            pricing.append(
                ProductPricing(
                    product_id=product.id,
                    name=product.name,
                    price_amount=price.price_amount,
                    currency=price.price_currency,
                    metrics=response,
                )
            )
        return pricing

    async def _customer_costs(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        org_id: uuid.UUID,
        detectors: Sequence[Detector],
        *,
        today: date,
        timezone: ZoneInfo,
    ) -> list[CustomerCostSignal]:
        """Per-customer cost ranking for detectors that declare a need.

        Backed by the events `by-customer` statistics (summing `_cost.amount`),
        which return each customer's share of the total — exactly the shape a
        concentration reading needs. Failures degrade to an empty ranking.
        """
        if not any(detector.needs_customer_costs for detector in detectors):
            return []
        try:
            stats = await event_service.list_customer_stats(
                cast(AsyncSession, session),
                auth_subject,
                start_date=today - timedelta(days=_CUSTOMER_COSTS_WINDOW_DAYS),
                end_date=today,
                timezone=timezone,
                organization_id=[org_id],
                limit=CUSTOMER_COSTS_SAMPLE_LIMIT,
            )
        except Exception:
            log.exception("compass.customer_costs_error", organization_id=str(org_id))
            return []
        return [
            CustomerCostSignal(
                label=stat.email
                or stat.name
                or stat.external_customer_id
                or str(stat.customer_id),
                amount=float(stat.totals.get("_cost_amount", 0)),
                share=float(stat.share),
            )
            for stat in stats.items
        ]

    async def _churn_breakdown(
        self,
        session: AsyncReadSession,
        org_id: uuid.UUID,
        detectors: Sequence[Detector],
        *,
        today: date,
        timezone: ZoneInfo,
    ) -> ChurnBreakdown | None:
        """Voluntary/involuntary split of the window's ended subscriptions,
        for detectors that declare a need. Failures degrade to None."""
        if not any(detector.needs_churn_breakdown for detector in detectors):
            return None
        since = datetime.combine(
            today - timedelta(days=_CHURN_BREAKDOWN_WINDOW_DAYS),
            datetime.min.time(),
            timezone,
        )
        try:
            voluntary, involuntary = await SubscriptionRepository.from_session(
                session
            ).get_churn_breakdown(org_id, since=since)
        except Exception:
            log.exception("compass.churn_breakdown_error", organization_id=str(org_id))
            return None
        return ChurnBreakdown(voluntary=voluntary, involuntary=involuntary)

    async def _currency_signals(
        self,
        session: AsyncReadSession,
        org_id: uuid.UUID,
        detectors: Sequence[Detector],
        *,
        today: date,
        timezone: ZoneInfo,
    ) -> list[CurrencyOpportunitySignal]:
        """Paid revenue attributable to presentment currencies the merchant
        does not price in, for detectors that declare a need.

        Orders are grouped by billing country, countries resolve to their
        presentment currency, and configured currencies drop out — what
        remains is the opportunity. Failures degrade to an empty list."""
        if not any(detector.needs_currency_signals for detector in detectors):
            return []
        since = datetime.combine(
            today - timedelta(days=_CURRENCY_WINDOW_DAYS),
            datetime.min.time(),
            timezone,
        )
        try:
            by_country = await OrderRepository.from_session(
                session
            ).get_paid_revenue_by_country(
                org_id,
                since=since,
                # The revenue-share denominator sums these rows, so the fetch
                # must cover every possible billing country (ISO has ~250);
                # a truncated fetch would overstate each currency's share.
                limit=250,
            )
            configured = await ProductRepository.from_session(
                session
            ).get_price_currencies(org_id)
        except Exception:
            log.exception("compass.currency_signals_error", organization_id=str(org_id))
            return []
        total_revenue = sum(revenue for _, _, revenue in by_country)
        if total_revenue <= 0:
            return []
        by_currency: dict[str, tuple[int, int, list[str]]] = {}
        for country, orders, revenue in by_country:
            presentment = get_presentment_currency(country)
            if presentment is None:
                continue
            currency = str(presentment).lower()
            if currency in configured:
                continue
            prev_orders, prev_revenue, countries = by_currency.get(currency, (0, 0, []))
            by_currency[currency] = (
                prev_orders + orders,
                prev_revenue + revenue,
                countries + [country],
            )
        signals = [
            CurrencyOpportunitySignal(
                currency=currency,
                revenue_share=revenue / total_revenue,
                order_count=orders,
                countries=tuple(countries[:3]),
            )
            for currency, (orders, revenue, countries) in by_currency.items()
        ]
        signals.sort(key=lambda signal: signal.revenue_share, reverse=True)
        return signals

    async def _compass_enabled_org_ids(
        self,
        session: AsyncReadSession,
        org_ids: set[AccessibleOrganizationID],
    ) -> set[AccessibleOrganizationID]:
        if not org_ids:
            return org_ids
        repository = OrganizationRepository.from_session(session)
        organizations = await repository.get_all(
            repository.get_statement_by_org_ids(org_ids)
        )
        return {
            AccessibleOrganizationID(org.id)
            for org in organizations
            if org.is_compass_enabled
        }

    def _select_detectors(
        self, category: Sequence[InsightCategory] | None
    ) -> list[Detector]:
        if category is None:
            return DETECTORS
        wanted = set(category)
        return [d for d in DETECTORS if d.category in wanted]


compass = CompassService()


__all__ = ["CompassService", "compass"]

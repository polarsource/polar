import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.customer.repository import CustomerRepository
from polar.enums import RecurringInterval
from polar.event.tinybird_repository import TinybirdEventRepository
from polar.event_type.repository import EventTypeRepository
from polar.exceptions import ResourceNotFound
from polar.integrations.tinybird.service import (
    TinybirdCustomerOrder,
    TinybirdFeaturePeriod,
)
from polar.kit.time_queries import TimeInterval
from polar.models import Customer, Organization, Product, User
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .schemas import (
    Feature,
    FeatureAnomaly,
    FeatureBreakdown,
    FeatureCustomer,
    FeatureDetail,
    FeatureDetailCustomer,
    FeatureHighlights,
    FeatureModel,
    FeaturePeriod,
    FeaturePlan,
    FeatureStep,
    FeatureSummary,
)

TOP_CUSTOMERS = 10
HIGHLIGHTS = 5
# A use costing this many times the median counts as an anomaly.
ANOMALY_MULTIPLE = 3
CENT = Decimal("0.01")

type CustomerKey = tuple[str | None, str | None]  # (customer_id, external_id)


@dataclass
class _Usage:
    occurrences: int = 0
    cost: Decimal = Decimal(0)
    input_tokens: int = 0
    output_tokens: int = 0
    revenue: Decimal = Decimal(0)


@dataclass
class _Economics:
    """Usage and cost per feature and customer, and each customer's revenue
    split across the features they used by their share of usage."""

    organization_id: uuid.UUID
    currency: str
    features: dict[str, dict[CustomerKey, _Usage]]
    customers_by_key: dict[CustomerKey, Customer]
    revenue_by_customer: dict[uuid.UUID, Decimal]
    # Each customer's revenue per product and per period.
    revenue_by_product: dict[uuid.UUID, dict[str | None, Decimal]]
    revenue_by_period: dict[uuid.UUID, dict[datetime, Decimal]]
    shares: dict[tuple[str, uuid.UUID], Decimal] = field(default_factory=dict)

    def customer(self, key: CustomerKey) -> Customer | None:
        return self.customers_by_key.get(key)


def _to_cents(value: float) -> Decimal:
    return Decimal(str(round(value, 12)))


def _buckets(start: datetime, end: datetime, interval: TimeInterval) -> list[datetime]:
    """Start of every period between two instants, as Tinybird truncates them."""
    current = start.replace(minute=0, second=0, microsecond=0)
    if interval != TimeInterval.hour:
        current = current.replace(hour=0)
    if interval == TimeInterval.week:
        current -= timedelta(days=current.weekday())
    elif interval == TimeInterval.month:
        current = current.replace(day=1)
    elif interval == TimeInterval.year:
        current = current.replace(month=1, day=1)
    buckets: list[datetime] = []
    while current < end:
        buckets.append(current)
        if interval == TimeInterval.hour:
            current += timedelta(hours=1)
        elif interval == TimeInterval.day:
            current += timedelta(days=1)
        elif interval == TimeInterval.week:
            current += timedelta(days=7)
        elif interval == TimeInterval.month:
            current = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
        else:
            current = current.replace(year=current.year + 1)
    return buckets


def _period_bounds(
    start_date: date, end_date: date, timezone: ZoneInfo
) -> tuple[datetime, datetime]:
    start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone)
    end = datetime(
        end_date.year, end_date.month, end_date.day, tzinfo=timezone
    ) + timedelta(days=1)
    return start, end


def _recognize(
    order: TinybirdCustomerOrder,
    start: datetime,
    end: datetime,
    buckets: Sequence[datetime],
) -> list[tuple[datetime, Decimal]]:
    """The order's amount recognized in each period of the window.

    A subscription order is spread evenly over the billing period it pays
    for, so an annual plan counts a twelfth in each month rather than all in
    the month it was paid. One-time orders and refunds count when they happen.
    """
    edges = [*buckets[1:], end]
    if order.recurring_interval is None:
        if not start <= order.timestamp < end:
            return []
        bucket = next(
            b for b, edge in zip(buckets, edges, strict=True) if order.timestamp < edge
        )
        return [(bucket, Decimal(order.amount))]

    period_start = order.timestamp
    period_end = RecurringInterval(order.recurring_interval).get_next_period(
        period_start, period_start.day, order.recurring_interval_count or 1
    )
    length = (period_end - period_start).total_seconds()
    if length <= 0:
        return []
    recognized: list[tuple[datetime, Decimal]] = []
    for bucket, edge in zip(buckets, edges, strict=True):
        overlap = (
            min(period_end, edge) - max(period_start, bucket, start)
        ).total_seconds()
        if overlap > 0:
            recognized.append(
                (bucket, Decimal(order.amount) * Decimal(overlap / length))
            )
    return recognized


class FeatureBreakdownService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
    ) -> FeatureBreakdown:
        economics = await self._get_economics(
            session,
            auth_subject,
            organization_id=organization_id,
            start_date=start_date,
            end_date=end_date,
            timezone=timezone,
            interval=interval,
        )
        names = await self._get_labels(session, economics)
        start, end = _period_bounds(start_date, end_date, timezone)
        period_rows = await TinybirdEventRepository().get_feature_periods(
            organization_id=organization_id,
            name=None,
            start_timestamp=start,
            end_timestamp=end,
            interval=interval.value,
            timezone=str(timezone),
        )
        buckets = _buckets(start, end, interval)
        features = [
            FeatureSummary(
                **self._to_feature(economics, name, usages, names).model_dump(),
                periods=self._to_periods(economics, name, period_rows, buckets),
            )
            for name, usages in economics.features.items()
        ]
        features.sort(key=lambda feature: feature.revenue, reverse=True)
        attributed = {customer_id for (_, customer_id) in economics.shares}
        return FeatureBreakdown(
            currency=economics.currency,
            revenue=round(sum(economics.revenue_by_customer.values(), Decimal(0))),
            unattributed_revenue=sum(
                (
                    amount
                    for customer_id, amount in economics.revenue_by_customer.items()
                    if customer_id not in attributed
                ),
                Decimal(0),
            ).quantize(CENT),
            cost=sum((feature.cost for feature in features), Decimal(0)),
            features=features,
        )

    async def get_feature(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        name: str,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
    ) -> FeatureDetail:
        economics = await self._get_economics(
            session,
            auth_subject,
            organization_id=organization_id,
            start_date=start_date,
            end_date=end_date,
            timezone=timezone,
            interval=interval,
        )
        usages = economics.features.get(name)
        if usages is None:
            raise ResourceNotFound()

        labels = await self._get_labels(session, economics)
        product_names = await self._get_product_names(session, economics)

        def plan_of(customer: Customer | None) -> str | None:
            if customer is None:
                return None
            by_product = economics.revenue_by_product.get(customer.id)
            if not by_product:
                return None
            product_id = max(by_product, key=lambda pid: by_product[pid])
            return product_names.get(product_id) if product_id else None

        customers: list[FeatureDetailCustomer] = []
        plans: dict[str | None, FeaturePlan] = {}
        for key, usage in usages.items():
            customer = economics.customer(key)
            plan = plan_of(customer)
            base = self._to_customer(economics, key, usage)
            customers.append(
                FeatureDetailCustomer(
                    **base.model_dump(),
                    plan=plan,
                    total_revenue=round(
                        economics.revenue_by_customer.get(customer.id, Decimal(0))
                    )
                    if customer
                    else 0,
                )
            )
            summary = plans.setdefault(
                plan,
                FeaturePlan(
                    name=plan,
                    customers=0,
                    occurrences=0,
                    cost=Decimal(0),
                    revenue=Decimal(0),
                ),
            )
            summary.customers += 1
            summary.occurrences += usage.occurrences
            summary.cost += usage.cost
            summary.revenue += usage.revenue

        start, end = _period_bounds(start_date, end_date, timezone)
        periods = await TinybirdEventRepository().get_feature_periods(
            organization_id=organization_id,
            name=name,
            start_timestamp=start,
            end_timestamp=end,
            interval=interval.value,
            timezone=str(timezone),
        )
        steps = await TinybirdEventRepository().get_feature_steps(
            organization_id=organization_id,
            name=name,
            start_timestamp=start,
            end_timestamp=end,
        )
        models = await TinybirdEventRepository().get_feature_models(
            organization_id=organization_id,
            name=name,
            start_timestamp=start,
            end_timestamp=end,
        )
        step_types = await EventTypeRepository.from_session(
            session
        ).get_by_names_and_organization([step.name for step in steps], organization_id)

        return FeatureDetail(
            currency=economics.currency,
            feature=self._to_feature(economics, name, usages, labels, top=0),
            customers=sorted(customers, key=lambda c: c.cost, reverse=True),
            plans=sorted(
                (
                    FeaturePlan(
                        name=plan.name,
                        customers=plan.customers,
                        occurrences=plan.occurrences,
                        cost=plan.cost,
                        revenue=plan.revenue.quantize(CENT),
                    )
                    for plan in plans.values()
                ),
                key=lambda plan: plan.revenue,
                reverse=True,
            ),
            periods=self._to_periods(
                economics, name, periods, _buckets(start, end, interval)
            ),
            steps=[
                FeatureStep(
                    name=step.name,
                    label=step_types[(organization_id, step.name)].label
                    if (organization_id, step.name) in step_types
                    else step.name,
                    occurrences=step.occurrences,
                    cost=_to_cents(step.cost),
                    input_tokens=step.input_tokens,
                    output_tokens=step.output_tokens,
                )
                for step in steps
            ],
            models=[
                FeatureModel(
                    vendor=model.vendor,
                    model=model.model,
                    calls=model.calls,
                    cost=_to_cents(model.cost),
                    input_tokens=model.input_tokens,
                    output_tokens=model.output_tokens,
                )
                for model in models
            ],
        )

    async def get_highlights(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        name: str,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
    ) -> FeatureHighlights:
        accessible = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.analytics_read
        )
        if organization_id not in accessible:
            raise ResourceNotFound()

        start, end = _period_bounds(start_date, end_date, timezone)
        repository = TinybirdEventRepository()
        median = await repository.get_feature_median_cost(
            organization_id=organization_id,
            name=name,
            start_timestamp=start,
            end_timestamp=end,
        )
        uses = (
            await repository.get_feature_costliest_uses(
                organization_id=organization_id,
                name=name,
                start_timestamp=start,
                end_timestamp=end,
                minimum=median * ANOMALY_MULTIPLE,
                limit=HIGHLIGHTS,
            )
            if median > 0
            else []
        )

        customers = await self._resolve_customers(
            session,
            AccessibleOrganizationID(organization_id),
            [(u.customer_id, u.external_customer_id) for u in uses],
        )

        def customer_fields(
            customer_id: str | None, external_customer_id: str | None
        ) -> dict[str, Any]:
            customer = customers.get((customer_id, external_customer_id))
            return {
                "customer_id": customer.id if customer else None,
                "external_customer_id": external_customer_id,
                "customer_name": (customer.name or customer.email)
                if customer
                else None,
            }

        median_cents = _to_cents(median)
        return FeatureHighlights(
            median_cost=median_cents,
            anomalies=[
                FeatureAnomaly(
                    id=uuid.UUID(use.id),
                    timestamp=use.timestamp,
                    cost=_to_cents(use.cost),
                    multiple=(_to_cents(use.cost) / median_cents).quantize(
                        Decimal("0.1")
                    ),
                    **customer_fields(use.customer_id, use.external_customer_id),
                )
                for use in uses
            ],
        )

    async def _get_economics(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
    ) -> _Economics:
        accessible = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.analytics_read
        )
        if organization_id not in accessible:
            raise ResourceNotFound()
        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id
        )
        if organization is None:
            raise ResourceNotFound()
        org_id = AccessibleOrganizationID(organization_id)
        currency = organization.default_presentment_currency

        start, end = _period_bounds(start_date, end_date, timezone)
        tinybird_repository = TinybirdEventRepository()
        usage_rows = await tinybird_repository.get_feature_customer_stats(
            organization_id=organization_id,
            start_timestamp=start,
            end_timestamp=end,
        )
        orders = await tinybird_repository.get_customer_orders(
            organization_id=organization_id,
            currency=currency,
            start_timestamp=start,
            end_timestamp=end,
        )

        keys: list[CustomerKey] = [
            *((r.customer_id, r.external_customer_id) for r in usage_rows),
            *((o.customer_id, o.external_customer_id) for o in orders),
        ]
        customers_by_key = await self._resolve_customers(session, org_id, keys)

        revenue_by_customer: dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        revenue_by_product: dict[uuid.UUID, dict[str | None, Decimal]] = defaultdict(
            lambda: defaultdict(Decimal)
        )
        revenue_by_period: dict[uuid.UUID, dict[datetime, Decimal]] = defaultdict(
            lambda: defaultdict(Decimal)
        )
        buckets = _buckets(start, end, interval)
        for order in orders:
            customer = customers_by_key.get(
                (order.customer_id, order.external_customer_id)
            )
            if customer is None:
                continue
            for bucket, amount in _recognize(order, start, end, buckets):
                revenue_by_customer[customer.id] += amount
                revenue_by_product[customer.id][order.product_id] += amount
                revenue_by_period[customer.id][bucket] += amount

        features: dict[str, dict[CustomerKey, _Usage]] = defaultdict(dict)
        usage_by_customer: dict[uuid.UUID, int] = defaultdict(int)
        for usage_row in usage_rows:
            key: CustomerKey = (usage_row.customer_id, usage_row.external_customer_id)
            usage = features[usage_row.name].setdefault(key, _Usage())
            usage.occurrences += usage_row.occurrences
            usage.cost += _to_cents(usage_row.cost)
            usage.input_tokens += usage_row.input_tokens
            usage.output_tokens += usage_row.output_tokens
            customer = customers_by_key.get(key)
            if customer is not None:
                usage_by_customer[customer.id] += usage_row.occurrences

        economics = _Economics(
            organization_id=organization_id,
            currency=currency,
            features=features,
            customers_by_key=customers_by_key,
            revenue_by_customer=revenue_by_customer,
            revenue_by_product=revenue_by_product,
            revenue_by_period=revenue_by_period,
        )
        for name, usages in features.items():
            for key, usage in usages.items():
                customer = customers_by_key.get(key)
                if customer is None or customer.id not in revenue_by_customer:
                    continue
                share = Decimal(usage.occurrences) / usage_by_customer[customer.id]
                usage.revenue = revenue_by_customer[customer.id] * share
                economics.shares[(name, customer.id)] = share
        return economics

    async def _resolve_customers(
        self,
        session: AsyncReadSession,
        organization_id: AccessibleOrganizationID,
        keys: Sequence[CustomerKey],
    ) -> dict[CustomerKey, Customer]:
        customer_ids = {uuid.UUID(cid) for cid, _ in keys if cid}
        external_ids = {eid for cid, eid in keys if eid and not cid}
        if not customer_ids and not external_ids:
            return {}
        repository = CustomerRepository.from_session(session)
        customers = await repository.get_all(
            repository.get_statement_by_org_ids({organization_id}).where(
                Customer.id.in_(customer_ids) | Customer.external_id.in_(external_ids)
            )
        )
        by_id = {str(c.id): c for c in customers}
        by_external_id = {c.external_id: c for c in customers if c.external_id}
        resolved: dict[CustomerKey, Customer] = {}
        for customer_id, external_id in keys:
            customer = (
                by_id.get(customer_id)
                if customer_id
                else by_external_id.get(external_id)
                if external_id
                else None
            )
            if customer is not None:
                resolved[(customer_id, external_id)] = customer
        return resolved

    async def _get_labels(
        self, session: AsyncReadSession, economics: _Economics
    ) -> dict[str, tuple[str, uuid.UUID]]:
        event_types = await EventTypeRepository.from_session(
            session
        ).get_by_names_and_organization(
            list(economics.features), economics.organization_id
        )
        return {name: (et.label, et.id) for (_, name), et in event_types.items()}

    async def _get_product_names(
        self, session: AsyncReadSession, economics: _Economics
    ) -> dict[str, str]:
        product_ids = {
            uuid.UUID(product_id)
            for by_product in economics.revenue_by_product.values()
            for product_id in by_product
            if product_id
        }
        if not product_ids:
            return {}
        repository = ProductRepository.from_session(session)
        products = await repository.get_all(
            repository.get_base_statement().where(Product.id.in_(product_ids))
        )
        return {str(product.id): product.name for product in products}

    def _to_periods(
        self,
        economics: _Economics,
        name: str,
        rows: Sequence[TinybirdFeaturePeriod],
        buckets: Sequence[datetime],
    ) -> list[FeaturePeriod]:
        revenue_by_bucket: dict[datetime, Decimal] = defaultdict(Decimal)
        for (feature_name, customer_id), share in economics.shares.items():
            if feature_name != name:
                continue
            for bucket, amount in economics.revenue_by_period.get(
                customer_id, {}
            ).items():
                revenue_by_bucket[bucket] += amount * share
        usage_by_bucket = {row.bucket: row for row in rows if row.name == name}
        return [
            FeaturePeriod(
                timestamp=bucket,
                occurrences=row.occurrences if row else 0,
                cost=_to_cents(row.cost) if row else Decimal(0),
                input_tokens=row.input_tokens if row else 0,
                output_tokens=row.output_tokens if row else 0,
                revenue=revenue_by_bucket.get(bucket, Decimal(0)).quantize(CENT),
            )
            for bucket in sorted(set(buckets) | set(usage_by_bucket))
            for row in [usage_by_bucket.get(bucket)]
        ]

    def _to_customer(
        self, economics: _Economics, key: CustomerKey, usage: _Usage
    ) -> FeatureCustomer:
        customer = economics.customer(key)
        return FeatureCustomer(
            customer_id=customer.id if customer else None,
            external_customer_id=key[1] or (customer.external_id if customer else None),
            name=customer.name if customer else None,
            email=customer.email if customer else None,
            occurrences=usage.occurrences,
            cost=usage.cost,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            revenue=usage.revenue.quantize(CENT),
        )

    def _to_feature(
        self,
        economics: _Economics,
        name: str,
        usages: dict[CustomerKey, _Usage],
        labels: dict[str, tuple[str, uuid.UUID]],
        top: int = TOP_CUSTOMERS,
    ) -> Feature:
        label, event_type_id = labels.get(name, (name, None))
        ranked = sorted(usages.items(), key=lambda item: item[1].cost, reverse=True)
        return Feature(
            name=name,
            label=label,
            event_type_id=event_type_id,
            occurrences=sum(u.occurrences for u in usages.values()),
            customers=len(usages),
            paying_customers=sum(1 for u in usages.values() if u.revenue > 0),
            cost=sum((u.cost for u in usages.values()), Decimal(0)),
            input_tokens=sum(u.input_tokens for u in usages.values()),
            output_tokens=sum(u.output_tokens for u in usages.values()),
            revenue=sum((u.revenue for u in usages.values()), Decimal(0)).quantize(
                CENT
            ),
            top_customers=[
                self._to_customer(economics, key, usage) for key, usage in ranked[:top]
            ],
        )


feature_breakdown = FeatureBreakdownService()

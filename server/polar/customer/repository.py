import contextlib
from collections.abc import AsyncGenerator, Iterable, Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    CTE,
    Numeric,
    Select,
    UnaryExpression,
    asc,
    case,
    cast,
    desc,
    func,
    literal,
    select,
    update,
)
from sqlalchemy import inspect as orm_inspect
from sqlalchemy.orm import InstanceState

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.event.system import CustomerUpdatedFields, SystemEvent
from polar.kit.pagination import PaginationParams
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import Customer, Event, Order, Subscription, UserOrganization
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import enqueue_job

from .schemas.analytics import CustomerCostTimeseries, CustomerWithMetrics
from .sorting import CustomerAnalyticsSortProperty


def _get_changed_value(
    inspection: InstanceState[Customer], attr_name: str
) -> tuple[bool, Any]:
    """
    Check if attribute changed and return (has_changed, new_value).
    Returns (False, None) if value didn't actually change.
    """
    attr = inspection.attrs[attr_name]
    history = attr.history

    if not history.has_changes():
        return (False, None)

    deleted = history.deleted[0] if history.deleted else None
    added = history.added[0] if history.added else None

    if deleted == added:
        return (False, None)

    return (True, added)


class CustomerRepository(
    RepositorySoftDeletionIDMixin[Customer, UUID],
    RepositorySoftDeletionMixin[Customer],
    RepositoryBase[Customer],
):
    model = Customer

    async def create(self, object: Customer, *, flush: bool = False) -> Customer:
        customer = await super().create(object, flush=flush)

        # We need the id to enqueue the job
        if customer.id is None:
            customer_id = Customer.__table__.c.id.default.arg(None)
            customer.id = customer_id

        return customer

    @contextlib.asynccontextmanager
    async def create_context(
        self, object: Customer, *, flush: bool = False
    ) -> AsyncGenerator[Customer]:
        customer = await self.create(object, flush=flush)
        yield customer
        assert customer.id is not None, "Customer.id is None"

        # If the customer has an external_id, enqueue a meter update job
        # to create meters for any pre-existing events with that external_id.
        if customer.external_id is not None:
            enqueue_job("customer_meter.update_customer", customer.id)

        enqueue_job("customer.webhook", WebhookEventType.customer_created, customer.id)
        enqueue_job("customer.event", customer.id, SystemEvent.customer_created)

    async def update(
        self,
        object: Customer,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> Customer:
        inspection = orm_inspect(object)

        customer = await super().update(object, update_dict=update_dict, flush=flush)
        enqueue_job("customer.webhook", WebhookEventType.customer_updated, customer.id)

        # Only create an event if the customer is not being deleted
        if not customer.deleted_at:
            updated_fields: CustomerUpdatedFields = {}

            changed, value = _get_changed_value(inspection, "name")
            if changed:
                updated_fields["name"] = value

            changed, value = _get_changed_value(inspection, "email")
            if changed:
                updated_fields["email"] = value

            changed, value = _get_changed_value(inspection, "billing_address")
            if changed:
                updated_fields["billing_address"] = value.to_dict() if value else None

            changed, value = _get_changed_value(inspection, "tax_id")
            if changed:
                updated_fields["tax_id"] = value[0] if value else None

            changed, value = _get_changed_value(inspection, "user_metadata")
            if changed:
                updated_fields["metadata"] = value

            enqueue_job(
                "customer.event",
                customer.id,
                SystemEvent.customer_updated,
                updated_fields,
            )

        return customer

    async def soft_delete(self, object: Customer, *, flush: bool = False) -> Customer:
        customer = await super().soft_delete(object, flush=flush)
        # Clear external_id for future recycling
        if customer.external_id:
            user_metadata = customer.user_metadata
            user_metadata["__external_id"] = customer.external_id
            # Store external_id in `user_metadata` for support debugging
            customer.user_metadata = user_metadata
            customer.external_id = None

        enqueue_job("customer.webhook", WebhookEventType.customer_deleted, customer.id)
        enqueue_job("customer.event", customer.id, SystemEvent.customer_deleted)

        return customer

    async def touch_meters(self, customers: Iterable[Customer]) -> None:
        statement = (
            update(Customer)
            .where(Customer.id.in_([c.id for c in customers]))
            .values(meters_dirtied_at=utc_now())
        )
        await self.session.execute(statement)

    async def set_meters_updated_at(self, customers: Iterable[Customer]) -> None:
        statement = (
            update(Customer)
            .where(Customer.id.in_([c.id for c in customers]))
            .values(meters_updated_at=utc_now())
        )
        await self.session.execute(statement)

    async def get_by_id_and_organization(
        self, id: UUID, organization_id: UUID
    ) -> Customer | None:
        statement = self.get_base_statement().where(
            Customer.id == id, Customer.organization_id == organization_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_email_and_organization(
        self, email: str, organization_id: UUID
    ) -> Customer | None:
        statement = self.get_base_statement().where(
            func.lower(Customer.email) == email.lower(),
            Customer.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> Customer | None:
        statement = self.get_base_statement().where(
            Customer.external_id == external_id,
            Customer.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_stripe_customer_id_and_organization(
        self, stripe_customer_id: str, organization_id: UUID
    ) -> Customer | None:
        statement = self.get_base_statement().where(
            Customer.stripe_customer_id == stripe_customer_id,
            Customer.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)

    async def stream_by_organization(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[UUID] | None,
    ) -> AsyncGenerator[Customer]:
        statement = self.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                Customer.organization_id.in_(organization_id),
            )

        async for customer in self.stream(statement):
            yield customer

    async def get_readable_by_id(
        self,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(Customer.id == id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_readable_by_external_id(
        self,
        auth_subject: AuthSubject[User | Organization],
        external_id: str,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(Customer.external_id == external_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Customer]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Customer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Customer.organization_id == auth_subject.subject.id,
            )

        return statement

    async def get_cost_metrics(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[CustomerAnalyticsSortProperty]],
    ) -> tuple[Sequence[CustomerWithMetrics], int]:
        event_agg_by_customer_id = (
            select(
                Event.customer_id.label("customer_id"),
                func.sum(
                    func.coalesce(
                        cast(Event.user_metadata["_cost"]["amount"].astext, Numeric),
                        literal(0),
                    )
                ).label("lifetime_cost"),
            )
            .where(
                Event.customer_id.is_not(None),
                Event.organization_id == organization_id,
                Event.timestamp >= start_date,
                Event.timestamp <= end_date,
            )
            .group_by(Event.customer_id)
            .cte("event_agg_by_customer_id")
        )

        event_agg_by_external_id = (
            select(
                Event.external_customer_id.label("external_customer_id"),
                func.sum(
                    func.coalesce(
                        cast(Event.user_metadata["_cost"]["amount"].astext, Numeric),
                        literal(0),
                    )
                ).label("lifetime_cost"),
            )
            .where(
                Event.customer_id.is_(None),
                Event.external_customer_id.is_not(None),
                Event.organization_id == organization_id,
                Event.timestamp >= start_date,
                Event.timestamp <= end_date,
            )
            .group_by(Event.external_customer_id)
            .cte("event_agg_by_external_id")
        )

        lifetime_revenue_subquery = (
            select(
                func.sum(
                    case(
                        (Order.paid, Order.net_amount - Order.refunded_amount),
                        else_=literal(0),
                    )
                ).label("lifetime_revenue")
            )
            .where(
                Order.customer_id == Customer.id,
                Order.deleted_at.is_(None),
                Order.created_at >= start_date,
                Order.created_at <= end_date,
            )
            .correlate(Customer)
            .scalar_subquery()
        )

        active_subscription_id_subquery = (
            select(Subscription.id)
            .where(
                Subscription.customer_id == Customer.id,
                Subscription.deleted_at.is_(None),
                Subscription.status == SubscriptionStatus.active,
            )
            .correlate(Customer)
            .limit(1)
            .scalar_subquery()
        )

        lifetime_cost_expr = func.coalesce(
            event_agg_by_customer_id.c.lifetime_cost, literal(0)
        ) + func.coalesce(event_agg_by_external_id.c.lifetime_cost, literal(0))

        lifetime_revenue_expr = func.coalesce(lifetime_revenue_subquery, literal(0))

        profit_expr = lifetime_revenue_expr - lifetime_cost_expr

        margin_percent_expr = case(
            (
                lifetime_revenue_expr > literal(0),
                func.round(profit_expr * literal(100) / lifetime_revenue_expr, 2),
            ),
            else_=literal(0),
        )

        lifetime_revenue_col = lifetime_revenue_expr.label("lifetime_revenue")
        lifetime_cost_col = lifetime_cost_expr.label("lifetime_cost")
        profit_col = profit_expr.label("profit")
        margin_percent_col = margin_percent_expr.label("margin_percent")

        statement = (
            select(
                Customer,
                Subscription,
                lifetime_revenue_col,
                lifetime_cost_col,
                profit_col,
                margin_percent_col,
            )
            .select_from(Customer)
            .outerjoin(
                Subscription,
                Subscription.id == active_subscription_id_subquery,
            )
            .outerjoin(
                event_agg_by_customer_id,
                event_agg_by_customer_id.c.customer_id == Customer.id,
            )
            .outerjoin(
                event_agg_by_external_id,
                event_agg_by_external_id.c.external_customer_id == Customer.external_id,
            )
            .where(
                Customer.deleted_at.is_(None),
                Customer.organization_id == organization_id,
            )
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Customer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Customer.organization_id == auth_subject.subject.id,
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerAnalyticsSortProperty.customer_name:
                order_by_clauses.append(clause_function(Customer.name).nullslast())
            elif criterion == CustomerAnalyticsSortProperty.email:
                order_by_clauses.append(clause_function(Customer.email))
            elif criterion == CustomerAnalyticsSortProperty.lifetime_revenue:
                order_by_clauses.append(
                    clause_function(lifetime_revenue_col).nullslast()
                )
            elif criterion == CustomerAnalyticsSortProperty.lifetime_cost:
                order_by_clauses.append(clause_function(lifetime_cost_col).nullslast())
            elif criterion == CustomerAnalyticsSortProperty.profit:
                order_by_clauses.append(clause_function(profit_col).nullslast())
            elif criterion == CustomerAnalyticsSortProperty.margin_percent:
                order_by_clauses.append(clause_function(margin_percent_col).nullslast())
        statement = statement.order_by(*order_by_clauses)

        count_statement = select(func.count()).select_from(statement.subquery())
        count_result = await self.session.execute(count_statement)
        count = count_result.scalar() or 0

        offset = (pagination.page - 1) * pagination.limit
        statement = statement.limit(pagination.limit).offset(offset)

        result = await self.session.execute(statement)
        rows = result.all()

        metrics = [
            CustomerWithMetrics(
                customer=row.Customer,
                subscription=row.Subscription,
                lifetime_revenue=int(row.lifetime_revenue)
                if row.lifetime_revenue
                else 0,
                lifetime_cost=int(row.lifetime_cost) if row.lifetime_cost else 0,
                profit=int(row.profit) if row.profit else 0,
                margin_percent=Decimal(str(row.margin_percent))
                if row.margin_percent
                else Decimal("0"),
            )
            for row in rows
        ]

        return metrics, count

    async def get_customers_cost_timeseries(
        self,
        organization_id: UUID,
        customer_ids: Sequence[UUID],
        timestamp_series_cte: CTE,
    ) -> dict[UUID, list[CustomerCostTimeseries]]:
        if not customer_ids:
            return {}

        period_col = func.date_trunc("day", Event.timestamp).label("period")
        cost_by_customer_and_period = (
            select(
                Event.customer_id.label("customer_id"),
                period_col,
                func.sum(
                    func.coalesce(
                        cast(Event.user_metadata["_cost"]["amount"].astext, Numeric),
                        literal(0),
                    )
                ).label("cost"),
            )
            .where(
                Event.organization_id == organization_id,
                Event.customer_id.in_(customer_ids),
            )
            .group_by(
                Event.customer_id,
                period_col,
            )
        ).cte("cost_by_customer_and_period")

        order_period_col = func.date_trunc("day", Order.created_at).label("period")
        revenue_by_customer_and_period = (
            select(
                Order.customer_id.label("customer_id"),
                order_period_col,
                func.sum(
                    case(
                        (
                            Order.status.in_(
                                (
                                    OrderStatus.paid,
                                    OrderStatus.refunded,
                                    OrderStatus.partially_refunded,
                                )
                            ),
                            (Order.subtotal_amount - Order.discount_amount)
                            - Order.refunded_amount,
                        ),
                        else_=literal(0),
                    )
                ).label("revenue"),
            )
            .where(
                Order.deleted_at.is_(None),
                Order.customer_id.in_(customer_ids),
            )
            .group_by(Order.customer_id, order_period_col)
        ).cte("revenue_by_customer_and_period")

        customers_subquery = (
            select(Customer.id.label("customer_id")).where(
                Customer.id.in_(customer_ids),
                Customer.deleted_at.is_(None),
            )
        ).cte("customer_ids_cte")

        statement = (
            select(
                customers_subquery.c.customer_id,
                timestamp_series_cte.c.timestamp,
                func.coalesce(cost_by_customer_and_period.c.cost, literal(0)).label(
                    "cost"
                ),
                func.coalesce(
                    revenue_by_customer_and_period.c.revenue, literal(0)
                ).label("revenue"),
            )
            .select_from(customers_subquery)
            .join(timestamp_series_cte, literal(True))
            .outerjoin(
                cost_by_customer_and_period,
                (
                    cost_by_customer_and_period.c.customer_id
                    == customers_subquery.c.customer_id
                )
                & (
                    cost_by_customer_and_period.c.period
                    == func.date_trunc("day", timestamp_series_cte.c.timestamp)
                ),
            )
            .outerjoin(
                revenue_by_customer_and_period,
                (
                    revenue_by_customer_and_period.c.customer_id
                    == customers_subquery.c.customer_id
                )
                & (
                    revenue_by_customer_and_period.c.period
                    == func.date_trunc("day", timestamp_series_cte.c.timestamp)
                ),
            )
            .order_by(
                customers_subquery.c.customer_id, timestamp_series_cte.c.timestamp
            )
        )

        result = await self.session.execute(statement)
        rows = result.all()

        timeseries_by_customer: dict[UUID, list[CustomerCostTimeseries]] = {}
        for row in rows:
            customer_id = row.customer_id
            if customer_id not in timeseries_by_customer:
                timeseries_by_customer[customer_id] = []
            timeseries_by_customer[customer_id].append(
                CustomerCostTimeseries(
                    timestamp=row.timestamp,
                    cost=Decimal(str(row.cost)) if row.cost else Decimal("0"),
                    revenue=Decimal(str(row.revenue)) if row.revenue else Decimal("0"),
                )
            )

        return timeseries_by_customer

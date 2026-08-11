import contextlib
from collections.abc import AsyncGenerator, Mapping, Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    Select,
    String,
    Uuid,
    and_,
    cast,
    column,
    func,
    or_,
    select,
    update,
    values,
)
from sqlalchemy import inspect as orm_inspect
from sqlalchemy.orm import InstanceState

from polar.authz.types import AccessibleOrganizationID
from polar.event.system import CustomerUpdatedFields, SystemEvent
from polar.kit.address import Address
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.models import Customer, Subscription
from polar.models.customer import EXTERNAL_ID_METADATA_KEY
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import enqueue_job


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

        # If the customer has an external_id, enqueue jobs to pick up any pre-existing
        # events with that external_id.
        if customer.external_id is not None:
            enqueue_job("customer_meter.update_customer", customer.id)
            enqueue_job("customer.resolve_first_user_event_at", customer.id)

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

        # Only create an event if the customer is not being deleted
        if not customer.deleted_at:
            enqueue_job(
                "customer.webhook", WebhookEventType.customer_updated, customer.id
            )

            updated_fields: CustomerUpdatedFields = {}

            changed, value = _get_changed_value(inspection, "name")
            if changed:
                updated_fields["name"] = value

            # `billing_name` is exposed via a property; the mapped column
            # attribute is `_billing_name`, so inspect that for changes.
            changed, value = _get_changed_value(inspection, "_billing_name")
            if changed:
                updated_fields["billing_name"] = value

            changed, value = _get_changed_value(inspection, "email")
            if changed:
                updated_fields["email"] = value

            changed, value = _get_changed_value(inspection, "billing_address")
            if changed:
                if value is None:
                    updated_fields["billing_address"] = None
                else:
                    updated_fields["billing_address"] = Address.model_validate(
                        value
                    ).to_dict()

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

            # Setting an external_id can attribute events ingested before the customer
            # existed. It's write-once, so this fires at most once per customer.
            changed, value = _get_changed_value(inspection, "external_id")
            if changed and value is not None:
                enqueue_job("customer.resolve_first_user_event_at", customer.id)

        return customer

    async def soft_delete(self, object: Customer, *, flush: bool = False) -> Customer:
        customer = await super().soft_delete(object, flush=flush)
        # Clear external_id for future recycling
        if customer.external_id:
            user_metadata = customer.user_metadata
            user_metadata[EXTERNAL_ID_METADATA_KEY] = customer.external_id
            # Store external_id in `user_metadata` for support debugging
            customer.user_metadata = user_metadata
            customer.external_id = None

        enqueue_job("customer.webhook", WebhookEventType.customer_deleted, customer.id)
        enqueue_job("customer.event", customer.id, SystemEvent.customer_deleted)

        return customer

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

    async def get_ids_by_email(self, email: str) -> Sequence[UUID]:
        statement = (
            self.get_base_statement()
            .with_only_columns(Customer.id)
            .where(func.lower(Customer.email) == email.lower())
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

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
        org_ids: set[AccessibleOrganizationID],
        organization_id: Sequence[UUID] | None,
    ) -> AsyncGenerator[Customer]:
        statement = self.get_statement_by_org_ids(org_ids)

        if organization_id is not None:
            statement = statement.where(
                Customer.organization_id.in_(organization_id),
            )

        async for customer in self.stream(statement):
            yield customer

    async def get_readable_by_id(
        self,
        org_ids: set[AccessibleOrganizationID],
        id: UUID,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .where(Customer.id == id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_readable_by_external_id(
        self,
        org_ids: set[AccessibleOrganizationID],
        external_id: str,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .where(Customer.external_id == external_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_readable_external_ids_by_ids(
        self,
        org_ids: set[AccessibleOrganizationID],
        customer_ids: Sequence[UUID],
    ) -> list[str]:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .with_only_columns(Customer.external_id)
            .where(
                Customer.id.in_(customer_ids),
                Customer.external_id.isnot(None),
            )
        )
        result = await self.session.execute(statement)
        return [r for r in result.scalars().all() if r is not None]

    async def get_readable_ids_by_external_ids(
        self,
        org_ids: set[AccessibleOrganizationID],
        external_ids: Sequence[str],
    ) -> list[UUID]:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .with_only_columns(Customer.id)
            .where(Customer.external_id.in_(external_ids))
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def search_by_query(
        self,
        org_ids: set[AccessibleOrganizationID],
        query: str,
    ) -> tuple[list[UUID], list[str]]:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .with_only_columns(Customer.id, Customer.external_id)
            .where(
                or_(
                    cast(Customer.id, String).ilike(f"%{query}%"),
                    Customer.external_id.ilike(f"%{query}%"),
                    Customer.name.ilike(f"%{query}%"),
                    Customer._billing_name.ilike(f"%{query}%"),
                    Customer.email.ilike(f"%{query}%"),
                ),
            )
        )
        result = await self.session.execute(statement)
        rows = result.all()
        customer_ids = [r.id for r in rows]
        external_ids = [r.external_id for r in rows if r.external_id is not None]
        return customer_ids, external_ids

    async def get_growth_per_period(
        self,
        organization_id: UUID,
        *,
        start: datetime,
        end: datetime,
        interval: TimeInterval,
    ) -> Sequence[tuple[datetime, int, int]]:
        """New and cumulative customer counts per interval bucket, zero-filled.

        Buckets cover whole intervals: the first bucket counts every customer
        created within it, even before `start`, matching the metrics layer.
        """
        timestamp_series = get_timestamp_series_cte(start, end, interval)
        timestamp_column = timestamp_series.c.timestamp

        bucket = interval.sql_date_trunc(timestamp_column).label("timestamp")
        grouped = (
            select(bucket, func.count(Customer.id).label("new_customers"))
            .select_from(timestamp_series)
            .join(
                Customer,
                isouter=True,
                onclause=and_(
                    interval.sql_date_trunc(Customer.created_at)
                    == interval.sql_date_trunc(timestamp_column),
                    Customer.organization_id == organization_id,
                    Customer.deleted_at.is_(None),
                ),
            )
            .group_by(bucket)
            .subquery("customer_growth")
        )

        customers_before_start = (
            select(func.count(Customer.id))
            .where(
                Customer.organization_id == organization_id,
                Customer.deleted_at.is_(None),
                Customer.created_at < interval.sql_date_trunc(start),
            )
            .scalar_subquery()
        )

        statement = select(
            grouped.c.timestamp,
            grouped.c.new_customers,
            (
                customers_before_start
                + func.sum(grouped.c.new_customers).over(order_by=grouped.c.timestamp)
            ).label("total_customers"),
        ).order_by(grouped.c.timestamp)

        result = await self.session.execute(statement)
        return [(row[0], int(row[1]), int(row[2])) for row in result.all()]

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Customer]]:
        statement = self.get_base_statement()
        statement = statement.where(Customer.organization_id.in_(org_ids))
        return statement

    def get_active_clause(self, active: bool) -> ColumnElement[bool]:
        """
        Return a clause to filter customers by activity.

        An active customer is one with at least one billable subscription,
        i.e. a subscription in `trialing`, `active` or `past_due` status.
        """
        subscription_exists = (
            select(Subscription.id)
            .where(
                Subscription.customer_id == Customer.id,
                Subscription.status.in_(SubscriptionStatus.billable_statuses()),
                Subscription.deleted_at.is_(None),
            )
            .exists()
        )
        return subscription_exists if active else ~subscription_exists

    async def increment_invoice_next_number(self, customer_id: UUID) -> int:
        """
        Atomically increment invoice_next_number and return the value before increment.
        """
        stmt = (
            update(Customer)
            .where(Customer.id == customer_id)
            .values(invoice_next_number=Customer.invoice_next_number + 1)
            .returning(Customer.invoice_next_number)
        )
        result = await self.session.execute(stmt)
        next_number = result.scalar_one()
        return next_number - 1

    async def get_ids_by_external_ids_and_organization(
        self, external_ids: Sequence[str], organization_id: UUID
    ) -> dict[str, UUID]:
        statement = (
            self.get_base_statement()
            .with_only_columns(Customer.external_id, Customer.id)
            .where(
                Customer.organization_id == organization_id,
                Customer.external_id.in_(external_ids),
            )
        )
        result = await self.session.execute(statement)
        return {external_id: id for external_id, id in result.all()}

    async def lower_first_user_event_at(
        self, timestamps: Mapping[UUID, datetime]
    ) -> None:
        """
        Move `first_user_event_at` earlier for each customer. Never later.
        """
        if not timestamps:
            return

        new_values = values(
            column("customer_id", Uuid),
            column("timestamp", TIMESTAMP(timezone=True)),
            name="new_first_user_event_at",
        ).data(list(timestamps.items()))

        statement = (
            update(Customer)
            .where(
                Customer.id == new_values.c.customer_id,
                or_(
                    Customer.first_user_event_at.is_(None),
                    Customer.first_user_event_at > new_values.c.timestamp,
                ),
            )
            .values(
                first_user_event_at=new_values.c.timestamp,
                modified_at=Customer.modified_at,
            )
        )
        await self.session.execute(statement)

    async def increment_receipt_next_number(self, customer_id: UUID) -> int:
        """
        Atomically increment receipt_next_number and return the value before increment.
        """
        stmt = (
            update(Customer)
            .where(Customer.id == customer_id)
            .values(receipt_next_number=Customer.receipt_next_number + 1)
            .returning(Customer.receipt_next_number)
        )
        result = await self.session.execute(stmt)
        next_number = result.scalar_one()
        return next_number - 1

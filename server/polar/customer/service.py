import uuid
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import UnaryExpression, asc, desc, func, or_
from sqlalchemy.orm import joinedload
from sqlalchemy_utils.types.range import timedelta

from polar.auth.models import AuthSubject
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.member import member_service
from polar.member.schemas import Member as MemberSchema
from polar.models import BenefitGrant, Customer, Organization, User
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import CustomerRepository
from .schemas.analytics import (
    CustomerCostTimeseries,
    CustomerMetricPeriod,
    CustomerMetrics,
    CustomerSubscription,
)
from .schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerUpdateExternalID,
)
from .schemas.state import CustomerState
from .sorting import CustomerAnalyticsSortProperty, CustomerSortProperty


class CustomerService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        email: str | None = None,
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerSortProperty]] = [
            (CustomerSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Customer], int]:
        repository = CustomerRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

        if email is not None:
            statement = statement.where(func.lower(Customer.email) == email.lower())

        if metadata is not None:
            statement = apply_metadata_clause(Customer, statement, metadata)

        if query is not None:
            statement = statement.where(
                or_(
                    Customer.email.ilike(f"%{query}%"),
                    Customer.name.ilike(f"%{query}%"),
                    Customer.external_id.ilike(f"{query}%"),
                )
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerSortProperty.created_at:
                order_by_clauses.append(clause_function(Customer.created_at))
            elif criterion == CustomerSortProperty.email:
                order_by_clauses.append(clause_function(Customer.email))
            elif criterion == CustomerSortProperty.customer_name:
                order_by_clauses.append(clause_function(Customer.name))
        statement = statement.order_by(*order_by_clauses)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Customer | None:
        repository = CustomerRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Customer.id == id
        )
        return await repository.get_one_or_none(statement)

    async def get_external(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        external_id: str,
    ) -> Customer | None:
        repository = CustomerRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Customer.external_id == external_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        customer_create: CustomerCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Customer:
        organization = await get_payload_organization(
            session, auth_subject, customer_create
        )
        repository = CustomerRepository.from_session(session)

        errors: list[ValidationError] = []

        if await repository.get_by_email_and_organization(
            customer_create.email, organization.id
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "email"),
                    "msg": "A customer with this email address already exists.",
                    "input": customer_create.email,
                }
            )

        if customer_create.external_id is not None:
            if await repository.get_by_external_id_and_organization(
                customer_create.external_id, organization.id
            ):
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "external_id"),
                        "msg": "A customer with this external ID already exists.",
                        "input": customer_create.external_id,
                    }
                )

        if errors:
            raise PolarRequestValidationError(errors)

        async with repository.create_context(
            Customer(
                organization=organization,
                **customer_create.model_dump(
                    exclude={"organization_id", "owner"}, by_alias=True
                ),
            )
        ) as customer:
            owner_email = customer_create.owner.email if customer_create.owner else None
            owner_name = customer_create.owner.name if customer_create.owner else None
            owner_external_id = (
                customer_create.owner.external_id if customer_create.owner else None
            )

            await member_service.create_owner_member(
                session,
                customer,
                organization,
                owner_email=owner_email,
                owner_name=owner_name,
                owner_external_id=owner_external_id,
            )
            return customer

    async def update(
        self,
        session: AsyncSession,
        customer: Customer,
        customer_update: CustomerUpdate | CustomerUpdateExternalID,
    ) -> Customer:
        repository = CustomerRepository.from_session(session)

        errors: list[ValidationError] = []
        if (
            customer_update.email is not None
            and customer.email.lower() != customer_update.email.lower()
        ):
            already_exists = await repository.get_by_email_and_organization(
                customer_update.email, customer.organization_id
            )
            if already_exists:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "A customer with this email address already exists.",
                        "input": customer_update.email,
                    }
                )

            customer.email = customer_update.email
            customer.email_verified = False

        if (
            isinstance(customer_update, CustomerUpdate)
            and "external_id" in customer_update.model_fields_set
            and customer.external_id is not None
            and customer.external_id != customer_update.external_id
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "external_id"),
                    "msg": "Customer external ID cannot be updated.",
                    "input": customer_update.external_id,
                }
            )

        if (
            isinstance(customer_update, CustomerUpdate)
            and customer_update.external_id is not None
            and customer.external_id != customer_update.external_id
        ):
            if await repository.get_by_external_id_and_organization(
                customer_update.external_id, customer.organization_id
            ):
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "external_id"),
                        "msg": "A customer with this external ID already exists.",
                        "input": customer_update.external_id,
                    }
                )

        if errors:
            raise PolarRequestValidationError(errors)

        return await repository.update(
            customer,
            update_dict=customer_update.model_dump(
                exclude={"email"}, exclude_unset=True, by_alias=True
            ),
        )

    async def delete(self, session: AsyncSession, customer: Customer) -> Customer:
        enqueue_job("subscription.cancel_customer", customer_id=customer.id)
        enqueue_job("benefit.revoke_customer", customer_id=customer.id)

        repository = CustomerRepository.from_session(session)
        return await repository.soft_delete(customer)

    async def get_state(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer: Customer,
        cache: bool = True,
    ) -> CustomerState:
        # 👋 Whenever you change the state schema,
        # please also update the cache key with a version number.
        cache_key = f"polar:customer_state:v3:{customer.id}"

        if cache:
            raw_state = await redis.get(cache_key)
            if raw_state is not None:
                return CustomerState.model_validate_json(raw_state)

        subscription_repository = SubscriptionRepository.from_session(session)
        customer.active_subscriptions = (
            await subscription_repository.list_active_by_customer(customer.id)
        )

        benefit_grant_repository = BenefitGrantRepository.from_session(session)
        customer.granted_benefits = (
            await benefit_grant_repository.list_granted_by_customer(
                customer.id, options=(joinedload(BenefitGrant.benefit),)
            )
        )

        customer_meter_repository = CustomerMeterRepository.from_session(session)
        customer.active_meters = await customer_meter_repository.get_all_by_customer(
            customer.id
        )

        state = CustomerState.model_validate(customer)

        await redis.set(
            cache_key,
            state.model_dump_json(),
            ex=int(timedelta(hours=1).total_seconds()),
        )

        return state

    async def webhook(
        self,
        session: AsyncSession,
        redis: Redis,
        event_type: CustomerWebhookEventType,
        customer: Customer,
    ) -> None:
        if event_type == WebhookEventType.customer_state_changed:
            data = await self.get_state(session, redis, customer, cache=False)
            await webhook_service.send(
                session,
                customer.organization,
                WebhookEventType.customer_state_changed,
                data,
            )
        else:
            await webhook_service.send(
                session, customer.organization, event_type, customer
            )

        # For created, updated and deleted events, also trigger a state changed event
        if event_type in (
            WebhookEventType.customer_created,
            WebhookEventType.customer_updated,
            WebhookEventType.customer_deleted,
        ):
            await self.webhook(
                session, redis, WebhookEventType.customer_state_changed, customer
            )

    async def load_members(
        self,
        session: AsyncReadSession,
        customer_id: uuid.UUID,
    ) -> Sequence[MemberSchema]:
        members = await member_service.list_by_customer(session, customer_id)
        return [MemberSchema.model_validate(member) for member in members]

    async def get_analytics(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[CustomerAnalyticsSortProperty]],
        include_periods: bool = False,
    ) -> tuple[Sequence[CustomerMetrics], int]:
        repository = CustomerRepository.from_session(session)

        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year,
            end_date.month,
            end_date.day,
            23,
            59,
            59,
            999999,
            timezone,
        )

        cost_metrics, count = await repository.get_cost_metrics(
            auth_subject,
            organization_id,
            start_timestamp,
            end_timestamp,
            pagination,
            sorting,
        )

        timeseries_by_customer: dict[uuid.UUID, list[CustomerCostTimeseries]] = {}
        if include_periods:
            timestamp_series_cte = get_timestamp_series_cte(
                start_timestamp, end_timestamp, interval
            )
            customer_ids = [m.customer.id for m in cost_metrics]
            timeseries_by_customer = await repository.get_customers_cost_timeseries(
                organization_id, customer_ids, timestamp_series_cte
            )

        customers: list[CustomerMetrics] = []
        for metric in cost_metrics:
            periods: list[CustomerMetricPeriod] = []
            if include_periods:
                timeseries = timeseries_by_customer.get(metric.customer.id, [])
                periods = [
                    CustomerMetricPeriod(
                        timestamp=ts.timestamp,
                        cost=ts.cost,
                        revenue=ts.revenue,
                        profit=ts.revenue - ts.cost,
                    )
                    for ts in timeseries
                ]

            subscription = None
            if metric.subscription is not None:
                subscription = CustomerSubscription(
                    id=metric.subscription.id,
                    status=metric.subscription.status,
                    amount=metric.subscription.amount,
                    currency=metric.subscription.currency,
                    recurring_interval=metric.subscription.recurring_interval,
                )

            customers.append(
                CustomerMetrics(
                    customer_id=metric.customer.id,
                    customer_name=metric.customer.name,
                    customer_email=metric.customer.email,
                    subscription=subscription,
                    lifetime_revenue=metric.lifetime_revenue,
                    lifetime_cost=metric.lifetime_cost,
                    profit=metric.profit,
                    margin_percent=metric.margin_percent,
                    periods=periods,
                )
            )

        return customers, count


customer = CustomerService()

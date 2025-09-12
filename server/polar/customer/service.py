import uuid
from collections.abc import Sequence
from typing import Any

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
from polar.models import BenefitGrant, Customer, Organization, User
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import CustomerRepository
from .schemas.customer import CustomerCreate, CustomerUpdate, CustomerUpdateExternalID
from .schemas.state import CustomerState
from .sorting import CustomerSortProperty


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
                    exclude={"organization_id"}, by_alias=True
                ),
            )
        ) as customer:
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

            # Reset verification status
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
            update_dict=customer_update.model_dump(exclude_unset=True, by_alias=True),
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
        cache_key = f"polar:customer_state:v2:{customer.id}"

        if cache:
            raw_state = await redis.get(cache_key)
            if raw_state is not None:
                return CustomerState.model_validate_json(raw_state)

        # If not cached, fetch from the database
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
        data: CustomerState | Customer
        if event_type == WebhookEventType.customer_state_changed:
            data = await self.get_state(session, redis, customer, cache=False)
            await webhook_service.send(
                session,
                customer.organization,
                WebhookEventType.customer_state_changed,
                data,
            )
        else:
            data = customer
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


customer = CustomerService()

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from sqlalchemy_utils.types.range import timedelta

from polar.auth.models import AuthSubject
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.anonymization import (
    ANONYMIZED_EMAIL_DOMAIN,
    anonymize_email_for_deletion,
    anonymize_for_deletion,
)
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.member.service import member_service
from polar.models import BenefitGrant, Customer, Organization, User
from polar.models.customer import CustomerType
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import CustomerRepository
from .schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerUpdateExternalID,
)
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

        try:
            async with repository.create_context(
                Customer(
                    organization=organization,
                    **customer_create.model_dump(
                        exclude={"organization_id", "owner"}, by_alias=True
                    ),
                )
            ) as customer:
                owner_email = (
                    customer_create.owner.email if customer_create.owner else None
                )
                owner_name = (
                    customer_create.owner.name if customer_create.owner else None
                )
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
        except IntegrityError as e:
            error_str = str(e)
            if "ix_customers_organization_id_email_case_insensitive" in error_str:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "email"),
                            "msg": "A customer with this email address already exists.",
                            "input": customer_create.email,
                        }
                    ]
                ) from e
            if "customers_organization_id_external_id_key" in error_str:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "external_id"),
                            "msg": "A customer with this external ID already exists.",
                            "input": customer_create.external_id,
                        }
                    ]
                ) from e
            raise

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

        # Prevent setting billing address to null
        if (
            "billing_address" in customer_update.model_fields_set
            and customer_update.billing_address is None
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "billing_address"),
                    "msg": "Customer billing address cannot be reset to null once set.",
                    "input": customer_update.billing_address,
                }
            )

        # Validate external_id changes (only for CustomerUpdate schema)
        if (
            isinstance(customer_update, CustomerUpdate)
            and "external_id" in customer_update.model_fields_set
            and customer.external_id != customer_update.external_id
        ):
            if customer.external_id is not None:
                # external_id was already set - cannot be changed
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "external_id"),
                        "msg": "Customer external ID cannot be updated.",
                        "input": customer_update.external_id,
                    }
                )
            elif (
                customer_update.external_id is not None
                and await repository.get_by_external_id_and_organization(
                    customer_update.external_id, customer.organization_id
                )
            ):
                # Setting new external_id that already exists
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "external_id"),
                        "msg": "A customer with this external ID already exists.",
                        "input": customer_update.external_id,
                    }
                )

        # Prevent downgrade from team to individual
        # NULL type is treated as 'individual' (legacy customers)
        current_type = customer.type or CustomerType.individual
        if (
            isinstance(customer_update, CustomerUpdate)
            and customer_update.type is not None
            and current_type == CustomerType.team
            and customer_update.type == CustomerType.individual
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "type"),
                    "msg": "Customer type cannot be downgraded from 'team' to 'individual'.",
                    "input": customer_update.type,
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

    async def delete(
        self,
        session: AsyncSession,
        customer: Customer,
        *,
        anonymize: bool = False,
    ) -> Customer:
        enqueue_job("subscription.cancel_customer", customer_id=customer.id)
        enqueue_job("benefit.revoke_customer", customer_id=customer.id)

        if anonymize:
            # Anonymize also sets deleted_at
            return await self.anonymize(session, customer)

        repository = CustomerRepository.from_session(session)
        return await repository.soft_delete(customer)

    async def anonymize(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> Customer:
        """
        Anonymize customer PII for GDPR compliance.

        This anonymizes personal data while:
        - Preserving the Stripe customer ID for payment history
        - Preserving external_id and tax_id for legal/tax reasons
        - Preserving name for businesses (identified by having tax_id)
        - Keeping order and subscription records intact (invoices are immutable)

        This is idempotent - calling it on an already-anonymized customer
        will return success without making changes.
        """
        # Skip if already anonymized (idempotent)
        if customer.email.endswith(f"@{ANONYMIZED_EMAIL_DOMAIN}"):
            return customer

        repository = CustomerRepository.from_session(session)
        update_dict: dict[str, Any] = {}

        # Anonymize email (always)
        update_dict["email"] = anonymize_email_for_deletion(customer.email)
        update_dict["email_verified"] = False

        # Anonymize name only for individuals (no tax_id = individual)
        # Businesses (has tax_id) retain name for legal reasons
        if customer.tax_id is None and customer.name:
            update_dict["name"] = anonymize_for_deletion(customer.name)

        # Anonymize billing_name (always, if present)
        if customer._billing_name:
            update_dict["_billing_name"] = anonymize_for_deletion(
                customer._billing_name
            )

        # Clear address (invoices retain original)
        update_dict["billing_address"] = None

        # Clear OAuth tokens
        update_dict["_oauth_accounts"] = {}

        # Mark as deleted (soft-delete)
        update_dict["deleted_at"] = utc_now()

        # Record anonymization timestamp in metadata
        user_metadata = dict(customer.user_metadata) if customer.user_metadata else {}
        user_metadata["__anonymized_at"] = utc_now().isoformat()
        update_dict["user_metadata"] = user_metadata

        # NOTE: external_id and tax_id are RETAINED for legal reasons

        # The repository.update() method automatically enqueues the webhook job
        customer = await repository.update(customer, update_dict=update_dict)

        return customer

    async def get_state(
        self,
        session: AsyncReadSession,
        redis: Redis,
        customer: Customer,
        cache: bool = True,
    ) -> CustomerState:
        # 👋 Whenever you change the state schema,
        # please also update the cache key with a version number.
        cache_key = f"polar:customer_state:v4:{customer.id}"

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

    async def state_changed(
        self, session: AsyncSession, redis: Redis, customer: Customer
    ) -> None:
        await self.get_state(session, redis, customer, cache=False)
        enqueue_job(
            "customer.webhook", WebhookEventType.customer_state_changed, customer.id
        )

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


customer = CustomerService()

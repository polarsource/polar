import builtins
import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

import structlog
from pydantic import TypeAdapter
from sqlalchemy import UnaryExpression, asc, desc, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.address import Address
from polar.kit.anonymization import (
    ANONYMIZED_EMAIL_DOMAIN,
    anonymize_email_for_deletion,
    anonymize_for_deletion,
)
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.member_session.service import member_session as member_session_service
from polar.models import BenefitGrant, Customer, Order, Organization, Subscription, User
from polar.models.customer import CustomerType
from polar.models.member import MemberRole
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.order.repository import OrderRepository
from polar.organization.resolver import get_payload_organization
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from polar.tax.tax_id import InvalidTaxID, validate_tax_id
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import CustomerRepository
from .schemas.customer import (
    CustomerIndividualCreate,
    CustomerTeamCreate,
    CustomerUpdate,
    CustomerUpdateExternalID,
)
from .schemas.state import CustomerState
from .sorting import CustomerSortProperty

log = structlog.get_logger()

# Pydantic TypeAdapter to validate/serialize the CustomerState union type
_CustomerStateAdapter: TypeAdapter[CustomerState] = TypeAdapter(CustomerState)


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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids)

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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids).where(
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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids).where(
            Customer.external_id == external_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        customer_create: CustomerIndividualCreate | CustomerTeamCreate,
        auth_subject: AuthSubject[User | Organization],
        *,
        created_at: datetime | None = None,
    ) -> Customer:
        organization = await get_payload_organization(
            session, auth_subject, customer_create
        )
        repository = CustomerRepository.from_session(session)

        errors: list[ValidationError] = []

        if (
            customer_create.email is not None
            and await repository.get_by_email_and_organization(
                customer_create.email, organization.id
            )
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

        validated_tax_id = None
        if customer_create.tax_id is not None:
            if customer_create.billing_address is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "missing",
                            "loc": ("body", "billing_address"),
                            "msg": "Country is required to validate tax ID.",
                            "input": None,
                        }
                    ]
                )
            try:
                validated_tax_id = validate_tax_id(
                    customer_create.tax_id,
                    customer_create.billing_address.country,
                )
            except InvalidTaxID as e:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "invalid",
                            "loc": ("body", "tax_id"),
                            "msg": "Invalid tax ID.",
                            "input": customer_create.tax_id,
                        }
                    ]
                ) from e

        customer_obj = Customer(
            organization=organization,
            **customer_create.model_dump(
                exclude={"organization_id", "owner", "tax_id"},
                by_alias=True,
            ),
            tax_id=validated_tax_id,
        )
        if created_at is not None:
            customer_obj.created_at = created_at

        return await self._persist_customer(
            session,
            customer_obj,
            organization,
            send_webhooks=True,
            owner_email=(
                customer_create.owner.email if customer_create.owner else None
            ),
            owner_name=(customer_create.owner.name if customer_create.owner else None),
            owner_external_id=(
                customer_create.owner.external_id if customer_create.owner else None
            ),
        )

    async def create_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        email: str,
        name: str | None = None,
        billing_address: Address | None = None,
        send_webhooks: bool = False,
    ) -> Customer:
        """Create a customer for a known organization (internal flows)."""
        repository = CustomerRepository.from_session(session)

        if await repository.get_by_email_and_organization(email, organization.id):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "A customer with this email address already exists.",
                        "input": email,
                    }
                ]
            )

        customer_obj = Customer(
            email=email,
            name=name,
            billing_address=billing_address,
            organization=organization,
        )

        return await self._persist_customer(
            session,
            customer_obj,
            organization,
            send_webhooks=send_webhooks,
        )

    async def _persist_customer(
        self,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        *,
        send_webhooks: bool,
        owner_email: str | None = None,
        owner_name: str | None = None,
        owner_external_id: str | None = None,
    ) -> Customer:
        repository = CustomerRepository.from_session(session)
        try:
            if send_webhooks:
                async with repository.create_context(customer) as created:
                    await member_service.create_owner_member(
                        session,
                        created,
                        organization,
                        owner_email=owner_email,
                        owner_name=owner_name,
                        owner_external_id=owner_external_id,
                    )
                    return created
            else:
                created = await repository.create(customer, flush=True)
                await member_service.create_owner_member(
                    session,
                    created,
                    organization,
                    owner_email=owner_email,
                    owner_name=owner_name,
                    owner_external_id=owner_external_id,
                )
                return created
        except IntegrityError as e:
            error_str = str(e)
            if "ix_customers_organization_id_email_not_null" in error_str:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "email"),
                            "msg": "A customer with this email address already exists.",
                            "input": customer.email,
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
                            "input": customer.external_id,
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

        email_changed = False

        errors: list[ValidationError] = []
        if customer_update.email is not None and (
            customer.email is None
            or customer.email.lower() != customer_update.email.lower()
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
            email_changed = True

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

        # Validate tax_id
        tax_id = customer_update.tax_id or (
            customer.tax_id[0] if customer.tax_id else None
        )
        if tax_id is not None:
            billing_address = (
                customer_update.billing_address
                if "billing_address" in customer_update.model_fields_set
                and customer_update.billing_address is not None
                else customer.billing_address
            )
            if billing_address is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "missing",
                            "loc": ("body", "billing_address"),
                            "msg": "Country is required to validate tax ID.",
                            "input": None,
                        }
                    ]
                )
            try:
                customer.tax_id = validate_tax_id(tax_id, billing_address.country)
            except InvalidTaxID as e:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "invalid",
                            "loc": ("body", "tax_id"),
                            "msg": "Invalid tax ID.",
                            "input": customer_update.tax_id,
                        }
                    ]
                ) from e

        try:
            updated_customer = await repository.update(
                customer,
                update_dict=customer_update.model_dump(
                    exclude={"email", "tax_id"}, exclude_unset=True, by_alias=True
                ),
            )
        except IntegrityError as e:
            error_str = str(e)
            if "customers_organization_id_external_id_key" in error_str:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "external_id"),
                            "msg": "A customer with this external ID already exists.",
                            "input": customer_update.external_id
                            if isinstance(customer_update, CustomerUpdate)
                            else None,
                        }
                    ]
                ) from e
            raise

        if email_changed:
            await member_service.sync_owner_email(session, updated_customer)

        return updated_customer

    async def delete(
        self,
        session: AsyncSession,
        customer: Customer,
        *,
        anonymize: bool = False,
    ) -> Customer:
        enqueue_job("subscription.cancel_customer", customer_id=customer.id)
        enqueue_job("benefit.revoke_customer", customer_id=customer.id)

        await member_service.delete_by_customer(session, customer.id)

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
        if self._is_anonymized(customer):
            return customer

        repository = CustomerRepository.from_session(session)
        update_dict: dict[str, Any] = {}

        # Anonymize email (if present)
        if customer.email is not None:
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

    def _is_anonymized(self, customer: Customer) -> bool:
        if customer.user_metadata.get("__anonymized_at") is not None:
            return True
        # Backward compat: customers anonymized before __anonymized_at was added
        if customer.email is not None and customer.email.endswith(
            f"@{ANONYMIZED_EMAIL_DOMAIN}"
        ):
            return True
        return False

    async def get_email_recipients(
        self,
        session: AsyncReadSession,
        customer: Customer,
    ) -> "builtins.list[str]":
        """Return deduplicated email addresses to use for notifications.

        For team customers: customer.email (if any) + owner/billing_manager emails.
        For individual customers: customer.email.
        """
        emails: builtins.list[str] = []

        if customer.email is not None:
            emails.append(customer.email)

        is_team = customer.type == CustomerType.team
        if is_team:
            member_repository = MemberRepository.from_session(session)
            members = await member_repository.list_by_customer(session, customer.id)
            for m in members:
                if (
                    m.email is not None
                    and m.role in (MemberRole.owner, MemberRole.billing_manager)
                    and m.email not in emails
                ):
                    emails.append(m.email)

        return emails

    async def create_session_token_for_recipient(
        self,
        session: AsyncSession,
        customer: Customer,
        recipient_email: str,
    ) -> str | None:
        """Create the appropriate session token for an email recipient.

        Individual customers get a customer session.
        Team customer members get a member session.
        """
        if customer.email is not None and customer.email == recipient_email:
            token, _ = await customer_session_service.create_customer_session(
                session, customer
            )
            return token

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(
            session, customer, recipient_email
        )
        if member is None:
            return None
        token, _ = await member_session_service.create_member_session(session, member)
        return token

    async def get_export(
        self,
        session: AsyncReadSession,
        customer: Customer,
    ) -> dict[str, Any]:
        payment_method_repository = PaymentMethodRepository.from_session(session)
        payment_methods = await payment_method_repository.list_by_customer(customer.id)

        subscription_repository = SubscriptionRepository.from_session(session)
        subscriptions = await subscription_repository.get_all_by_customer(
            customer.id,
            options=(joinedload(Subscription.product),),
        )

        order_repository = OrderRepository.from_session(session)
        orders = await order_repository.get_all_by_customer(
            customer.id,
            options=(joinedload(Order.product),),
        )

        benefit_grant_repository = BenefitGrantRepository.from_session(session)
        benefit_grants = await benefit_grant_repository.get_all_by_customer(
            customer.id,
            options=(joinedload(BenefitGrant.benefit),),
        )

        return {
            "customer": {
                "id": str(customer.id),
                "email": customer.email,
                "name": customer.name,
                "billing_name": customer.billing_name,
                "billing_address": customer.billing_address.model_dump()
                if customer.billing_address
                else None,
                "tax_id": list(customer.tax_id) if customer.tax_id else None,
                "external_id": customer.external_id,
                "created_at": customer.created_at.isoformat(),
                "modified_at": customer.modified_at.isoformat()
                if customer.modified_at
                else None,
            },
            "subscriptions": [
                {
                    "id": str(sub.id),
                    "status": sub.status,
                    "product_id": str(sub.product_id),
                    "product_name": sub.product.name,
                    "amount": sub.amount,
                    "currency": sub.currency,
                    "recurring_interval": sub.recurring_interval,
                    "started_at": sub.started_at.isoformat()
                    if sub.started_at
                    else None,
                    "ended_at": sub.ended_at.isoformat() if sub.ended_at else None,
                    "current_period_start": sub.current_period_start.isoformat(),
                    "current_period_end": sub.current_period_end.isoformat(),
                    "cancel_at_period_end": sub.cancel_at_period_end,
                    "canceled_at": sub.canceled_at.isoformat()
                    if sub.canceled_at
                    else None,
                    "created_at": sub.created_at.isoformat(),
                    "modified_at": sub.modified_at.isoformat()
                    if sub.modified_at
                    else None,
                }
                for sub in subscriptions
            ],
            "orders": [
                {
                    "id": str(order.id),
                    "status": order.status,
                    "invoice_number": order.invoice_number,
                    "product_id": str(order.product_id),
                    "product_name": order.product.name if order.product else None,
                    "subtotal_amount": order.subtotal_amount,
                    "discount_amount": order.discount_amount,
                    "net_amount": order.net_amount,
                    "tax_amount": order.tax_amount,
                    "total_amount": order.total_amount,
                    "currency": order.currency,
                    "billing_reason": order.billing_reason,
                    "created_at": order.created_at.isoformat(),
                    "modified_at": order.modified_at.isoformat()
                    if order.modified_at
                    else None,
                }
                for order in orders
            ],
            "payment_methods": [
                {
                    "id": str(pm.id),
                    "type": pm.type,
                    "method_metadata": pm.method_metadata,
                    "created_at": pm.created_at.isoformat(),
                    "modified_at": pm.modified_at.isoformat()
                    if pm.modified_at
                    else None,
                }
                for pm in payment_methods
            ],
            "benefit_grants": [
                {
                    "id": str(grant.id),
                    "benefit_id": str(grant.benefit_id),
                    "benefit_type": grant.benefit.type,
                    "benefit_description": grant.benefit.description,
                    "is_granted": grant.is_granted,
                    "is_revoked": grant.is_revoked,
                    "granted_at": grant.granted_at.isoformat()
                    if grant.granted_at
                    else None,
                    "revoked_at": grant.revoked_at.isoformat()
                    if grant.revoked_at
                    else None,
                    "subscription_id": str(grant.subscription_id)
                    if grant.subscription_id
                    else None,
                    "order_id": str(grant.order_id) if grant.order_id else None,
                    "created_at": grant.created_at.isoformat(),
                }
                for grant in benefit_grants
            ],
        }

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
                return _CustomerStateAdapter.validate_json(raw_state)

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

        state = _CustomerStateAdapter.validate_python(customer, from_attributes=True)

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

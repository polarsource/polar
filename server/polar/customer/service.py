import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, func, or_
from stripe import Customer as StripeCustomer

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Organization, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .repository import CustomerRepository
from .schemas import CustomerCreate, CustomerUpdate
from .sorting import CustomerSortProperty


class CustomerService:
    async def list(
        self,
        session: AsyncSession,
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
        session: AsyncSession,
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
        session: AsyncSession,
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

        customer = Customer(
            organization=organization,
            **customer_create.model_dump(exclude={"organization_id"}, by_alias=True),
        )
        return await repository.create(customer)

    async def update(
        self, session: AsyncSession, customer: Customer, customer_update: CustomerUpdate
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
            "external_id" in customer_update.model_fields_set
            and customer.external_id is not None
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "external_id"),
                    "msg": "Customer external ID cannot be updated.",
                    "input": customer_update.external_id,
                }
            )

        if customer_update.external_id is not None:
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
        # TODO: cancel subscriptions, revoke benefits, etc.

        repository = CustomerRepository.from_session(session)
        return await repository.soft_delete(customer)

    async def get_or_create_from_stripe_customer(
        self,
        session: AsyncSession,
        stripe_customer: StripeCustomer,
        organization: Organization,
    ) -> Customer:
        """
        Get or create a customer from a Stripe customer object.

        Make a first lookup by the Stripe customer ID, then by the email address.

        If the customer does not exist, create a new one.
        """
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_stripe_customer_id_and_organization(
            stripe_customer.id, organization.id
        )
        assert stripe_customer.email is not None
        if customer is None:
            customer = await repository.get_by_email_and_organization(
                stripe_customer.email, organization.id
            )
        if customer is None:
            customer = Customer(
                email=stripe_customer.email,
                email_verified=False,
                stripe_customer_id=stripe_customer.id,
                name=stripe_customer.name,
                billing_address=stripe_customer.address,
                # TODO: tax_id,
                organization=organization,
            )
        customer.stripe_customer_id = stripe_customer.id

        session.add(customer)
        return customer


customer = CustomerService()

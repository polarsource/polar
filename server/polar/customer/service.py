import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, func, select
from stripe import Customer as StripeCustomer

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import Customer, Organization, User, UserOrganization
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .schemas import CustomerCreate, CustomerUpdate
from .sorting import CustomerSortProperty


class CustomerService(ResourceServiceReader[Customer]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerSortProperty]] = [
            (CustomerSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Customer], int]:
        statement = self._get_readable_customer_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

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

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Customer | None:
        statement = self._get_readable_customer_statement(auth_subject).where(
            Customer.id == id
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        authz: Authz,
        customer_create: CustomerCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Customer:
        subject = auth_subject.subject

        organization = await get_payload_organization(
            session, auth_subject, customer_create
        )
        if not await authz.can(subject, AccessType.write, organization):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "organization_id"),
                        "msg": "Organization not found.",
                        "input": organization.id,
                    }
                ]
            )

        if await self.get_by_email_and_organization(
            session, customer_create.email, organization
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "A customer with this email address already exists.",
                        "input": customer_create.email,
                    }
                ]
            )

        customer = Customer(
            organization=organization,
            **customer_create.model_dump(exclude={"organization_id"}),
        )

        session.add(customer)
        return customer

    async def update(
        self, session: AsyncSession, customer: Customer, customer_update: CustomerUpdate
    ) -> Customer:
        if (
            customer_update.email is not None
            and customer.email.lower() != customer_update.email.lower()
            and await self.get_by_email_and_organization(
                session, customer_update.email, customer.organization
            )
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "A customer with this email address already exists.",
                        "input": customer_update.email,
                    }
                ]
            )

        for attr, value in customer_update.model_dump(exclude_unset=True).items():
            setattr(customer, attr, value)

        session.add(customer)
        return customer

    async def delete(self, session: AsyncSession, customer: Customer) -> Customer:
        # TODO: cancel subscriptions, revoke benefits, etc.

        customer.set_deleted_at()
        session.add(customer)
        return customer

    async def get_by_id_and_organization(
        self, session: AsyncSession, id: uuid.UUID, organization: Organization
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.deleted_at.is_(None),
            Customer.id == id,
            Customer.organization_id == organization.id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_email_and_organization(
        self, session: AsyncSession, email: str, organization: Organization
    ) -> Customer | None:
        statement = select(Customer).where(
            func.lower(Customer.email) == email.lower(),
            Customer.organization_id == organization.id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_stripe_customer_id(
        self, session: AsyncSession, stripe_customer_id: str
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.deleted_at.is_(None),
            Customer.stripe_customer_id == stripe_customer_id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

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
        customer = await self.get_by_stripe_customer_id(session, stripe_customer.id)
        assert stripe_customer.email is not None
        if customer is None:
            customer = await self.get_by_email_and_organization(
                session, stripe_customer.email, organization
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

    def _get_readable_customer_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Customer]]:
        statement = select(Customer).where(Customer.deleted_at.is_(None))

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


customer = CustomerService(Customer)

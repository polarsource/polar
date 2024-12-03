from sqlalchemy import select
from stripe import Customer as StripeCustomer

from polar.kit.services import ResourceServiceReader
from polar.models import Customer, Organization
from polar.postgres import AsyncSession


class CustomerService(ResourceServiceReader[Customer]):
    async def get_by_id_and_organization(
        self, session: AsyncSession, id: str, organization: Organization
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.deleted_at.is_(None),
            Customer.id == id,
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

    async def create_from_stripe_customer(
        self,
        session: AsyncSession,
        stripe_customer: StripeCustomer,
        organization: Organization,
    ) -> Customer:
        customer = Customer(
            email=stripe_customer.email,
            email_verified=False,
            stripe_customer_id=stripe_customer.id,
            name=stripe_customer.name,
            billing_address=stripe_customer.address,
            # TODO: tax_id,
            organization=organization,
        )

        session.add(customer)
        return customer


customer = CustomerService(Customer)

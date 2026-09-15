from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.kit.repository import RepositoryBase
from polar.models import Customer, VoidBillingIdentity, VoidCustomerBinding


class CustomerBindingRepository(RepositoryBase[VoidCustomerBinding]):
    model = VoidCustomerBinding

    def get_active_statement(
        self, organization_id: UUID
    ) -> Select[tuple[VoidCustomerBinding]]:
        return (
            self.get_base_statement()
            .join(VoidCustomerBinding.customer)
            .join(VoidCustomerBinding.billing_identity)
            .where(
                VoidCustomerBinding.organization_id == organization_id,
                VoidCustomerBinding.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
                VoidBillingIdentity.deleted_at.is_(None),
                VoidBillingIdentity.parent_id.is_(None),
            )
            .options(
                contains_eager(VoidCustomerBinding.customer),
                contains_eager(VoidCustomerBinding.billing_identity),
            )
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidCustomerBinding]:
        return await self.get_all(
            self.get_active_statement(organization_id).order_by(
                Customer.created_at, Customer.id
            )
        )

    async def get_active_by_external_id(
        self, organization_id: UUID, external_id: str
    ) -> VoidCustomerBinding | None:
        return await self.get_one_or_none(
            self.get_active_statement(organization_id).where(
                VoidBillingIdentity.external_id == external_id
            )
        )

    async def get_by_customer_id(
        self, organization_id: UUID, customer_id: UUID
    ) -> VoidCustomerBinding | None:
        return await self.get_one_or_none(
            self.get_base_statement()
            .where(
                VoidCustomerBinding.organization_id == organization_id,
                VoidCustomerBinding.customer_id == customer_id,
            )
            .options(joinedload(VoidCustomerBinding.customer))
        )

    async def get_by_identity_id(
        self, organization_id: UUID, identity_id: UUID
    ) -> VoidCustomerBinding | None:
        return await self.get_one_or_none(
            self.get_base_statement()
            .where(
                VoidCustomerBinding.organization_id == organization_id,
                VoidCustomerBinding.billing_identity_id == identity_id,
            )
            .options(joinedload(VoidCustomerBinding.customer))
        )

    async def lock_customer(
        self, organization_id: UUID, customer_id: UUID
    ) -> Customer | None:
        statement = (
            select(Customer)
            .where(
                Customer.id == customer_id,
                Customer.organization_id == organization_id,
                Customer.deleted_at.is_(None),
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

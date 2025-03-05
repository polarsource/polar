from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer, UserOrganization
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import enqueue_job


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

        assert customer.id is not None, "Customer.id is None"
        enqueue_job("customer.webhook", WebhookEventType.customer_created, customer.id)

        return customer

    async def update(
        self,
        object: Customer,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> Customer:
        customer = await super().update(object, update_dict=update_dict, flush=flush)
        enqueue_job("customer.webhook", WebhookEventType.customer_updated, customer.id)
        return customer

    async def soft_delete(self, object: Customer, *, flush: bool = False) -> Customer:
        customer = await super().soft_delete(object, flush=flush)
        enqueue_job("customer.webhook", WebhookEventType.customer_deleted, customer.id)
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

import contextlib
from collections.abc import AsyncGenerator, Iterable, Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select, update

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import BaseCustomer, Customer, PlaceholderCustomer, UserOrganization
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import enqueue_job


class BaseCustomerRepository(
    RepositorySoftDeletionIDMixin[BaseCustomer, UUID],
    RepositorySoftDeletionMixin[BaseCustomer],
    RepositoryBase[BaseCustomer],
):
    """Repository for working with all customer types (Customer and PlaceholderCustomer)."""

    model = BaseCustomer

    async def get_by_id_and_organization(
        self, id: UUID, organization_id: UUID
    ) -> BaseCustomer | None:
        statement = self.get_base_statement().where(
            BaseCustomer.id == id, BaseCustomer.organization_id == organization_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> BaseCustomer | None:
        statement = self.get_base_statement().where(
            BaseCustomer.external_id == external_id,
            BaseCustomer.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)

    async def touch_meters(self, customers: Iterable[BaseCustomer]) -> None:
        statement = (
            update(BaseCustomer)
            .where(BaseCustomer.id.in_([c.id for c in customers]))
            .values(meters_dirtied_at=utc_now())
        )
        await self.session.execute(statement)

    async def set_meters_updated_at(self, customers: Iterable[BaseCustomer]) -> None:
        statement = (
            update(BaseCustomer)
            .where(BaseCustomer.id.in_([c.id for c in customers]))
            .values(meters_updated_at=utc_now())
        )
        await self.session.execute(statement)


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

        # If the customer has an external_id, enqueue a meter update job
        # to create meters for any pre-existing events with that external_id.
        if customer.external_id is not None:
            enqueue_job("customer_meter.update_customer", customer.id)

        enqueue_job("customer.webhook", WebhookEventType.customer_created, customer.id)

    async def update(
        self,
        object: Customer,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> Customer:
        # Check if this is a placeholder promotion (adding email to placeholder)
        was_placeholder = object.email is None
        is_adding_email = (
            update_dict is not None
            and "email" in update_dict
            and update_dict["email"] is not None
        )
        is_placeholder_promotion = was_placeholder and is_adding_email

        customer = await super().update(object, update_dict=update_dict, flush=flush)

        # Send appropriate webhook: customer.created for promotion, customer.updated otherwise
        if is_placeholder_promotion:
            enqueue_job(
                "customer.webhook", WebhookEventType.customer_created, customer.id
            )
        else:
            enqueue_job(
                "customer.webhook", WebhookEventType.customer_updated, customer.id
            )

        return customer

    async def soft_delete(self, object: Customer, *, flush: bool = False) -> Customer:
        customer = await super().soft_delete(object, flush=flush)
        # Clear external_id for future recycling
        if customer.external_id:
            user_metadata = customer.user_metadata
            user_metadata["__external_id"] = customer.external_id
            # Store external_id in `user_metadata` for support debugging
            customer.user_metadata = user_metadata
            customer.external_id = None

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
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[UUID] | None,
    ) -> AsyncGenerator[Customer]:
        statement = self.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                Customer.organization_id.in_(organization_id),
            )

        async for customer in self.stream(statement):
            yield customer

    def get_readable_statement(
        self,
        auth_subject: AuthSubject[User | Organization],
    ) -> Select[tuple[Customer]]:
        statement = self.get_base_statement()

        # Exclude placeholder customers (those without email)
        statement = statement.where(Customer.email.is_not(None))

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


class PlaceholderCustomerRepository(
    RepositorySoftDeletionIDMixin[PlaceholderCustomer, UUID],
    RepositorySoftDeletionMixin[PlaceholderCustomer],
    RepositoryBase[PlaceholderCustomer],
):
    model = PlaceholderCustomer

    async def create_placeholder(
        self, external_id: str, organization_id: UUID
    ) -> PlaceholderCustomer:
        """
        Create a placeholder customer for event ingestion.
        This customer has no email (email=None indicates placeholder status).

        Note: We enqueue the meter update job to process pre-existing events,
        but skip the customer.created webhook since this is an internal placeholder.
        The webhook will be sent when the customer is promoted (via update with email).
        """
        placeholder = PlaceholderCustomer(
            external_id=external_id,
            organization_id=organization_id,
            email=None,
        )
        placeholder = await self.create(placeholder, flush=True)

        # Enqueue meter update job to process pre-existing events with this external_id
        enqueue_job("customer_meter.update_customer", placeholder.id)

        return placeholder

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> PlaceholderCustomer | None:
        statement = self.get_base_statement().where(
            PlaceholderCustomer.external_id == external_id,
            PlaceholderCustomer.organization_id == organization_id,
            PlaceholderCustomer.email.is_(None),
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self,
        auth_subject: AuthSubject[User | Organization],
    ) -> Select[tuple[PlaceholderCustomer]]:
        statement = self.get_base_statement()

        # Only include placeholder customers (those without email)
        statement = statement.where(PlaceholderCustomer.email.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                PlaceholderCustomer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                PlaceholderCustomer.organization_id == auth_subject.subject.id,
            )

        return statement

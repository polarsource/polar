import contextlib
from collections.abc import AsyncGenerator, Iterable, Sequence
from typing import Any, cast
from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy import inspect as orm_inspect
from sqlalchemy.orm import InstanceState

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.event.system import CustomerUpdatedFields, SystemEvent
from polar.kit.address import Address, AddressDict
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import Customer, UserOrganization
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import enqueue_job


def _get_changed_value(
    inspection: InstanceState[Customer], attr_name: str
) -> tuple[bool, Any]:
    """
    Check if attribute changed and return (has_changed, new_value).
    Returns (False, None) if value didn't actually change.
    """
    attr = inspection.attrs[attr_name]
    history = attr.history

    if not history.has_changes():
        return (False, None)

    deleted = history.deleted[0] if history.deleted else None
    added = history.added[0] if history.added else None

    if deleted == added:
        return (False, None)

    return (True, added)


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
        enqueue_job("customer.event", customer.id, SystemEvent.customer_created)

    async def update(
        self,
        object: Customer,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> Customer:
        inspection = orm_inspect(object)

        customer = await super().update(object, update_dict=update_dict, flush=flush)
        enqueue_job("customer.webhook", WebhookEventType.customer_updated, customer.id)

        # Only create an event if the customer is not being deleted
        if not customer.deleted_at:
            updated_fields: CustomerUpdatedFields = {}

            changed, value = _get_changed_value(inspection, "name")
            if changed:
                updated_fields["name"] = value

            changed, value = _get_changed_value(inspection, "email")
            if changed:
                updated_fields["email"] = value

            changed, value = _get_changed_value(inspection, "billing_address")
            if changed:
                if value is None:
                    updated_fields["billing_address"] = None
                elif isinstance(value, Address):
                    updated_fields["billing_address"] = value.to_dict()
                else:
                    updated_fields["billing_address"] = cast(AddressDict, value)

            changed, value = _get_changed_value(inspection, "tax_id")
            if changed:
                updated_fields["tax_id"] = value[0] if value else None

            changed, value = _get_changed_value(inspection, "user_metadata")
            if changed:
                updated_fields["metadata"] = value

            enqueue_job(
                "customer.event",
                customer.id,
                SystemEvent.customer_updated,
                updated_fields,
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
        enqueue_job("customer.event", customer.id, SystemEvent.customer_deleted)

        return customer

    async def touch_meters(self, customers: Iterable[Customer]) -> None:
        statement = (
            update(Customer)
            .where(Customer.id.in_([c.id for c in customers]))
            .values(meters_dirtied_at=utc_now())
        )
        await self.session.execute(statement)

    async def set_meters_updated_at(self, customers: Iterable[Customer]) -> None:
        statement = (
            update(Customer)
            .where(Customer.id.in_([c.id for c in customers]))
            .values(meters_updated_at=utc_now())
        )
        await self.session.execute(statement)

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

    async def get_readable_by_id(
        self,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(Customer.id == id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_readable_by_external_id(
        self,
        auth_subject: AuthSubject[User | Organization],
        external_id: str,
        *,
        options: Options = (),
    ) -> Customer | None:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(Customer.external_id == external_id)
            .options(*options)
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

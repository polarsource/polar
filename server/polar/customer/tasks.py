import uuid
from typing import Literal

from sqlalchemy.orm import joinedload

from polar.event.service import event as event_service
from polar.event.system import CustomerUpdatedFields, SystemEvent, build_system_event
from polar.exceptions import PolarTaskError
from polar.models import Customer
from polar.models.webhook_endpoint import CustomerWebhookEventType
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .repository import CustomerRepository
from .service import customer as customer_service


class CustomerTaskError(PolarTaskError): ...


class CustomerDoesNotExist(CustomerTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


@actor(actor_name="customer.webhook", priority=TaskPriority.MEDIUM)
async def customer_webhook(
    event_type: CustomerWebhookEventType, customer_id: uuid.UUID
) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(
            customer_id,
            include_deleted=True,
            options=(joinedload(Customer.organization),),
        )

        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        await customer_service.webhook(
            session, RedisMiddleware.get(), event_type, customer
        )


@actor(actor_name="customer.event", priority=TaskPriority.LOW)
async def customer_event(
    customer_id: uuid.UUID,
    event_name: Literal[
        SystemEvent.customer_created,
        SystemEvent.customer_updated,
        SystemEvent.customer_deleted,
    ],
    updated_fields: CustomerUpdatedFields | None = None,
) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(
            customer_id,
            include_deleted=True,
            options=(joinedload(Customer.organization),),
        )

        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        match event_name:
            case SystemEvent.customer_created:
                event = build_system_event(
                    event_name,
                    customer=customer,
                    organization=customer.organization,
                    metadata={
                        "customer_id": str(customer.id),
                        "customer_email": customer.email,
                        "customer_name": customer.name,
                        "customer_external_id": customer.external_id,
                    },
                )
            case SystemEvent.customer_deleted:
                event = build_system_event(
                    event_name,
                    customer=customer,
                    organization=customer.organization,
                    metadata={
                        "customer_id": str(customer.id),
                        "customer_email": customer.email,
                        "customer_name": customer.name,
                        "customer_external_id": customer.external_id,
                    },
                )
            case SystemEvent.customer_updated:
                event = build_system_event(
                    event_name,
                    customer=customer,
                    organization=customer.organization,
                    metadata={
                        "customer_id": str(customer.id),
                        "customer_email": customer.email,
                        "customer_name": customer.name,
                        "customer_external_id": customer.external_id,
                        "updated_fields": updated_fields or {},
                    },
                )

        await event_service.create_event(session, event)

import uuid
from typing import Literal

from sqlalchemy.orm import joinedload

from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.event.system import CustomerUpdatedFields, SystemEvent, build_system_event
from polar.exceptions import PolarTaskError
from polar.integrations.tinybird import service as tinybird_service
from polar.models import Customer
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .repository import CustomerRepository
from .service import customer as customer_service


class CustomerTaskError(PolarTaskError): ...


class CustomerDoesNotExist(CustomerTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


@actor(actor_name="customer.state_changed", priority=TaskPriority.HIGH)
async def customer_state_changed(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(
            customer_id,
            include_deleted=True,
            options=(joinedload(Customer.organization),),
        )

        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        await customer_service.state_changed(session, RedisMiddleware.get(), customer)


def _customer_resolve_first_user_event_at_debounce_key(customer_id: uuid.UUID) -> str:
    return f"customer.resolve_first_user_event_at:{customer_id}"


@actor(
    actor_name="customer.resolve_first_user_event_at",
    priority=TaskPriority.LOW,
    debounce_key=_customer_resolve_first_user_event_at_debounce_key,
)
async def customer_resolve_first_user_event_at(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(customer_id, include_deleted=True)

        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        first_user_event_at = await tinybird_service.get_first_user_event_at(
            organization_id=customer.organization_id,
            customer_id=customer.id,
            external_customer_id=customer.external_id,
        )

        if first_user_event_at is None:
            event_repository = EventRepository.from_session(session)
            first_user_event_at = await event_repository.get_first_user_event_timestamp(
                customer
            )

        if first_user_event_at is not None:
            await repository.lower_first_user_event_at(
                {customer.id: first_user_event_at}
            )


def _customer_webhook_debounce_key(
    event_type: CustomerWebhookEventType, customer_id: uuid.UUID
) -> str | None:
    if event_type != WebhookEventType.customer_state_changed:
        return None
    return f"customer.webhook:{event_type}:{customer_id}"


@actor(
    actor_name="customer.webhook",
    priority=TaskPriority.MEDIUM,
    debounce_key=_customer_webhook_debounce_key,
    debounce_min_threshold=1,
    debounce_max_threshold=5,
)
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
                        "customer_external_id": customer.saved_external_id,
                    },
                    timestamp=customer.created_at,
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
                        "customer_external_id": customer.saved_external_id,
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
                        "customer_external_id": customer.saved_external_id,
                        "updated_fields": updated_fields or {},
                    },
                )

        await event_service.create_event(session, event)

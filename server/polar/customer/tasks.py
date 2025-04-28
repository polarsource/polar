import uuid

from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.models import Customer
from polar.models.webhook_endpoint import CustomerWebhookEventType
from polar.worker import AsyncSessionMaker, actor

from .repository import CustomerRepository
from .service import customer as customer_service


class CustomerTaskError(PolarTaskError): ...


class CustomerDoesNotExist(CustomerTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


@actor(actor_name="customer.webhook")
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

        await customer_service.webhook(session, event_type, customer)

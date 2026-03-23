import uuid

from opentelemetry import trace

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, TaskPriority, actor, get_message_timestamp

from .service import customer_meter as customer_meter_service


class CustomerMeterTaskError(PolarTaskError): ...


class CustomerDoesNotExist(CustomerMeterTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


def _update_customer_debounce_key(customer_id: uuid.UUID) -> str:
    return f"customer_meter.update_customer:{customer_id}"


@actor(
    actor_name="customer_meter.update_customer",
    priority=TaskPriority.LOW,
    max_retries=1,
    min_backoff=30_000,
    debounce_key=_update_customer_debounce_key,
    debounce_min_threshold=int(
        settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD.total_seconds()
    ),
    debounce_max_threshold=int(
        settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD.total_seconds()
    ),
)
async def update_customer(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(customer_id, include_deleted=True)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        if customer.is_deleted:
            assert customer.deleted_at is not None
            # If the message was enqueued after the customer was deleted, it's a bug
            if get_message_timestamp() > customer.deleted_at:
                raise CustomerDoesNotExist(customer_id)
            # Otherwise, just discard.
            # It can happen under normal circumstances with race conditions or retries
            return

        span = trace.get_current_span()
        span.set_attribute("organization_id", str(customer.organization_id))

        await customer_meter_service.update_customer(session, customer)

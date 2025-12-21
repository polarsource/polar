import uuid
from datetime import datetime

from opentelemetry import trace

from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarTaskError
from polar.locker import Locker
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .service import customer_meter as customer_meter_service


class CustomerMeterTaskError(PolarTaskError): ...


class CustomerDoesNotExist(CustomerMeterTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="customer_meter.update_customer",
    priority=TaskPriority.LOW,
    max_retries=1,
    min_backoff=30_000,
)
async def update_customer(
    customer_id: uuid.UUID, meters_dirtied_at: str | None = None
) -> None:
    async with AsyncSessionMaker() as session:
        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_id(customer_id)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        span = trace.get_current_span()
        span.set_attribute("organization_id", str(customer.organization_id))

        redis = RedisMiddleware.get()
        locker = Locker(redis)
        meters_dirtied = (
            datetime.fromisoformat(meters_dirtied_at) if meters_dirtied_at else None
        )
        await customer_meter_service.update_customer(
            session, locker, customer, meters_dirtied
        )

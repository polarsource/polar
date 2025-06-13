import uuid

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import CheckoutRepository
from .service import checkout as checkout_service


class CheckoutTaskError(PolarTaskError): ...


@actor(actor_name="checkout.handle_free_success", priority=TaskPriority.HIGH)
async def handle_free_success(checkout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await checkout_service.handle_free_success(session, checkout_id)


@actor(actor_name="checkout.payment_success", priority=TaskPriority.HIGH)
async def payment_success(checkout_id: uuid.UUID, payment_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await checkout_service.handle_payment_success(session, checkout_id, payment_id)


@actor(actor_name="checkout.payment_failed", priority=TaskPriority.HIGH)
async def payment_failed(checkout_id: uuid.UUID, payment_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await checkout_service.handle_payment_failed(session, checkout_id)


@actor(
    actor_name="checkout.expire_open_checkouts",
    cron_trigger=CronTrigger.from_crontab("0,15,30,45 * * * *"),
    priority=TaskPriority.LOW,
)
async def expire_open_checkouts() -> None:
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        await repository.expire_open_checkouts()

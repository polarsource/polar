import uuid

from polar.exceptions import PolarTaskError
from polar.models.checkout import CheckoutStatus
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    RedisMiddleware,
    TaskPriority,
    actor,
    enqueue_job,
)

from .repository import CheckoutRepository
from .service import checkout as checkout_service


class CheckoutTaskError(PolarTaskError): ...


class CheckoutDoesNotExist(CheckoutTaskError):
    def __init__(self, checkout_id: uuid.UUID) -> None:
        self.checkout_id = checkout_id
        message = f"The checkout with id {checkout_id} does not exist."
        super().__init__(message)


@actor(actor_name="checkout.handle_free_success", priority=TaskPriority.HIGH)
async def handle_free_success(checkout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        checkout = await repository.get_by_id(
            checkout_id, options=repository.get_eager_options()
        )
        if checkout is None:
            raise CheckoutDoesNotExist(checkout_id)
        await checkout_service.handle_success(session, RedisMiddleware.get(), checkout)


@actor(
    actor_name="checkout.expire_open_checkouts",
    cron_trigger=CronTrigger.from_crontab("0,15,30,45 * * * *"),
    priority=TaskPriority.LOW,
)
async def expire_open_checkouts() -> None:
    expired_checkout_ids: list[uuid.UUID] = []
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        expired_checkout_ids = await repository.expire_open_checkouts()

    for checkout_id in expired_checkout_ids:
        enqueue_job("checkout.expired", checkout_id=checkout_id)


@actor(actor_name="checkout.expired", priority=TaskPriority.HIGH)
async def checkout_expired(checkout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        checkout = await repository.get_by_id(
            checkout_id, options=repository.get_eager_options()
        )
        if checkout is None:
            raise CheckoutDoesNotExist(checkout_id)

        # Double check status
        if checkout.status != CheckoutStatus.expired:
            return

        await checkout_service.send_expiration_events(session, checkout)

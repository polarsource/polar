import uuid

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

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
        await checkout_service.handle_success(session, checkout)


@actor(
    actor_name="checkout.expire_open_checkouts",
    cron_trigger=CronTrigger.from_crontab("0,15,30,45 * * * *"),
    priority=TaskPriority.LOW,
)
async def expire_open_checkouts() -> None:
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        checkouts_to_expire = await repository.expire_open_checkouts()
        
        for checkout in checkouts_to_expire:
            await checkout_service.expire_checkout(session, checkout)
        
        await session.commit()

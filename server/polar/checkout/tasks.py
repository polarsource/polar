import asyncio
import uuid
from typing import Annotated

import structlog

from polar.config import settings
from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.checkout import CheckoutStatus
from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .repository import CheckoutRepository
from .service import checkout as checkout_service

log: Logger = structlog.get_logger()


class CheckoutTaskError(PolarTaskError): ...


class CheckoutDoesNotExist(CheckoutTaskError):
    def __init__(self, checkout_id: uuid.UUID) -> None:
        self.checkout_id = checkout_id
        message = f"The checkout with id {checkout_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="checkout.handle_free_success",
    priority=TaskPriority.HIGH,
)
async def handle_free_success(checkout_id: Annotated[uuid.UUID, LoggableField]) -> None:
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
    expired_checkout_ids: list[uuid.UUID] = []
    async with AsyncSessionMaker() as session:
        repository = CheckoutRepository.from_session(session)
        expired_checkout_ids = await repository.expire_open_checkouts()

    for checkout_id in expired_checkout_ids:
        enqueue_job("checkout.expired", checkout_id=checkout_id)


@actor(
    actor_name="checkout.expired",
    priority=TaskPriority.HIGH,
)
async def checkout_expired(checkout_id: Annotated[uuid.UUID, LoggableField]) -> None:
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


@actor(
    actor_name="checkout.anonymize_expired",
    cron_trigger=CronTrigger.from_crontab("0 1 * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def anonymize_expired() -> None:
    older_than = utc_now() - settings.EXPIRED_CHECKOUT_RETENTION_PERIOD
    anonymized = 0
    while True:
        async with AsyncSessionMaker() as session:
            repository = CheckoutRepository.from_session(session)
            batch = await repository.anonymize_expired(older_than, batch_size=5000)
        if batch == 0:
            break
        anonymized += batch
        await asyncio.sleep(0.1)

    log.info(
        "checkout.anonymize_expired",
        anonymized=anonymized,
        older_than=older_than,
    )

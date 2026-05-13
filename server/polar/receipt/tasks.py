import uuid

import structlog

from polar.exceptions import PolarTaskError
from polar.locker import Locker, TimeoutLockError
from polar.logging import Logger
from polar.order.repository import OrderRepository
from polar.worker import (
    AsyncSessionMaker,
    RedisMiddleware,
    TaskPriority,
    TaskQueue,
    actor,
    enqueue_job,
)

from .service import receipt as receipt_service

log: Logger = structlog.get_logger()

RENDER_RETRY_DELAY_MS = 5_000


class ReceiptTaskError(PolarTaskError): ...


class ReceiptOrderDoesNotExist(ReceiptTaskError):
    def __init__(self, order_id: uuid.UUID) -> None:
        self.order_id = order_id
        super().__init__(f"Order {order_id} does not exist.")


async def _run_receipt_render(order_id: uuid.UUID) -> None:
    locker = Locker(RedisMiddleware.get())
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id, options=repository.get_eager_options()
        )
        if order is None:
            raise ReceiptOrderDoesNotExist(order_id)

        try:
            await receipt_service.generate_order_receipt(session, locker, order)
        except TimeoutLockError:
            # Another worker is already rendering. Re-enqueue with a delay
            # so the latest refund state isn't lost when their render
            # completes against an older snapshot.
            log.info(
                "receipt render: lock contention, re-enqueueing",
                order_id=str(order_id),
            )
            enqueue_job("receipt.render", order_id, delay=RENDER_RETRY_DELAY_MS)


@actor(
    actor_name="receipt.render",
    priority=TaskPriority.LOW,
    queue_name=TaskQueue.INVOICES_AND_RECEIPTS,
    time_limit=180_000,  # 3 min: 120s lock TTL + 60s render budget + headroom
)
async def receipt_render(order_id: uuid.UUID) -> None:
    await _run_receipt_render(order_id)

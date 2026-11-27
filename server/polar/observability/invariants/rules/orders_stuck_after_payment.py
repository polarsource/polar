from datetime import timedelta
from uuid import UUID

from polar.kit.utils import utc_now
from polar.order.repository import OrderRepository

from .base import Invariant, InvariantError


class OrdersStuckAfterPaymentInvariantError(InvariantError):
    def __init__(self, count: int, orders: list[UUID]) -> None:
        super().__init__(
            OrdersStuckAfterPaymentInvariant,
            f"Found {count} orders still pending more than 5 minutes after a successful payment.",
            {
                "count": count,
                "orders": {"ids": orders, "has_more": count > len(orders)},
            },
        )


class OrdersStuckAfterPaymentInvariant(Invariant):
    LIMIT = 10
    AGE_LIMIT = timedelta(days=7)
    LEEWAY = timedelta(minutes=5)

    async def check(self) -> None:
        repository = OrderRepository.from_session(self.session)
        now = utc_now()
        orders, count = await repository.get_pending_with_succeeded_payment_ids(
            now - self.AGE_LIMIT, now - self.LEEWAY, limit=self.LIMIT
        )
        if count > 0:
            raise OrdersStuckAfterPaymentInvariantError(count, orders)

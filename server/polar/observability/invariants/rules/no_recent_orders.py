from datetime import datetime, timedelta

from sqlalchemy import func, select

from polar.config import Environment
from polar.kit.utils import utc_now
from polar.models import Order

from .base import Invariant, InvariantError


class NoRecentOrdersInvariantError(InvariantError):
    """Exception raised when the NoRecentOrdersInvariant check fails."""

    def __init__(self, threshold: timedelta, last_order_at: datetime | None) -> None:
        message = (
            f"No new order created in the last {threshold}. "
            "The checkout or payment pipeline may be stalled."
        )
        super().__init__(
            NoRecentOrdersInvariant,
            message,
            {
                "threshold": str(threshold),
                "last_order_at": last_order_at.isoformat() if last_order_at else None,
            },
        )


class NoRecentOrdersInvariant(Invariant):
    """
    Invariant that checks a new order has been created recently.

    In production, orders are created continuously. A prolonged silence does not
    happen under normal traffic and indicates the checkout or payment pipeline is
    stalled. Only runs in production, where traffic is continuous; other
    environments have too little traffic for the absence of orders to be meaningful.
    """

    ENVIRONMENTS = {Environment.production}
    THRESHOLD = timedelta(minutes=15)

    async def check(self) -> None:
        last_order_at = await self.session.scalar(select(func.max(Order.created_at)))

        if last_order_at is None or last_order_at < utc_now() - self.THRESHOLD:
            raise NoRecentOrdersInvariantError(self.THRESHOLD, last_order_at)

from datetime import timedelta
from uuid import UUID

from polar.checkout.repository import CheckoutRepository
from polar.kit.utils import utc_now

from .base import Invariant, InvariantError


class CheckoutsStuckAfterPaymentInvariantError(InvariantError):
    def __init__(self, count: int, checkouts: list[UUID]) -> None:
        super().__init__(
            CheckoutsStuckAfterPaymentInvariant,
            f"Found {count} checkouts still confirmed more than 5 minutes after a successful payment.",
            {
                "count": count,
                "checkouts": {"ids": checkouts, "has_more": count > len(checkouts)},
            },
        )


class CheckoutsStuckAfterPaymentInvariant(Invariant):
    LIMIT = 10
    AGE_LIMIT = timedelta(days=7)
    LEEWAY = timedelta(minutes=5)

    async def check(self) -> None:
        repository = CheckoutRepository.from_session(self.session)
        now = utc_now()
        checkouts, count = await repository.get_confirmed_with_succeeded_payment_ids(
            now - self.AGE_LIMIT, now - self.LEEWAY, limit=self.LIMIT
        )
        if count > 0:
            raise CheckoutsStuckAfterPaymentInvariantError(count, checkouts)

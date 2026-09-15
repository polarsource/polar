from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from polar.kit.utils import utc_now
from polar.payment.repository import PaymentRepository

from .base import Invariant, InvariantError


class PaymentsMissingTransactionsInvariantError(InvariantError):
    def __init__(self, count: int, payments: Sequence[UUID]) -> None:
        super().__init__(
            PaymentsMissingTransactionsInvariant,
            f"Found {count} succeeded payments without a payment transaction.",
            {
                "count": count,
                "payments": {
                    "ids": payments,
                    "has_more": count == PaymentsMissingTransactionsInvariant.LIMIT,
                },
            },
        )


class PaymentsMissingTransactionsInvariant(Invariant):
    LIMIT = 10
    AGE_LIMIT = timedelta(days=30)

    async def check(self) -> None:
        repository = PaymentRepository.from_session(self.session)
        payments = await repository.get_succeeded_without_transaction_ids(
            utc_now() - self.AGE_LIMIT, limit=self.LIMIT
        )
        if payments:
            raise PaymentsMissingTransactionsInvariantError(len(payments), payments)

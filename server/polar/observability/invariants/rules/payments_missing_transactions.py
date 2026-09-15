from uuid import UUID

from polar.payment.repository import PaymentRepository

from .base import Invariant, InvariantError


class PaymentsMissingTransactionsInvariantError(InvariantError):
    def __init__(self, count: int, payments: list[UUID]) -> None:
        super().__init__(
            PaymentsMissingTransactionsInvariant,
            f"Found {count} succeeded payments without a payment transaction.",
            {
                "count": count,
                "payments": {
                    "ids": payments,
                    "has_more": count > len(payments),
                },
            },
        )


class PaymentsMissingTransactionsInvariant(Invariant):
    LIMIT = 10

    async def check(self) -> None:
        repository = PaymentRepository.from_session(self.session)
        payments, count = await repository.get_succeeded_without_transaction_ids(
            limit=self.LIMIT
        )
        if count > 0:
            raise PaymentsMissingTransactionsInvariantError(count, payments)

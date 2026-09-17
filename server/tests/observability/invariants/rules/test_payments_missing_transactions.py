from datetime import timedelta

import pytest

from polar.kit.utils import utc_now
from polar.models import Organization
from polar.models.payment import PaymentStatus
from polar.models.transaction import TransactionType
from polar.observability.invariants.rules.payments_missing_transactions import (
    PaymentsMissingTransactionsInvariant,
    PaymentsMissingTransactionsInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payment, create_payment_transaction
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestCheck:
    @pytest.mark.parametrize("count", [0, 1, 10, 15])
    async def test_missing_transactions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        count: int,
    ) -> None:
        for status in PaymentStatus:
            payment = await create_payment(save_fixture, organization, status=status)
            if status == PaymentStatus.succeeded:
                await create_payment_transaction(
                    save_fixture, charge_id=payment.processor_id
                )
        await create_payment_transaction(save_fixture, charge_id=None)

        old_payment = await create_payment(save_fixture, organization)
        old_payment.created_at = utc_now() - timedelta(days=31)
        await save_fixture(old_payment)

        payments = []
        for _ in range(count):
            payment = await create_payment(save_fixture, organization)
            await create_payment_transaction(
                save_fixture,
                charge_id=payment.processor_id,
                created_at=utc_now() - timedelta(days=31),
            )
            await create_transaction(
                save_fixture,
                type=TransactionType.refund,
                charge_id=payment.processor_id,
            )
            payments.append(payment)

        invariant = PaymentsMissingTransactionsInvariant(session)
        if count == 0:
            await invariant.check()
        else:
            with pytest.raises(PaymentsMissingTransactionsInvariantError) as exc_info:
                await invariant.check()
            assert exc_info.value.context == {
                "count": min(count, 10),
                "payments": {
                    "ids": [
                        payment.id
                        for payment in sorted(
                            payments,
                            key=lambda payment: (payment.created_at, payment.id),
                        )[:10]
                    ],
                    "has_more": count >= 10,
                },
            }

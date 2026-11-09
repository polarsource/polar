from collections.abc import AsyncIterator

import pytest
import stripe
from pytest_mock import MockerFixture

from polar.models.processor_transaction import Processor
from polar.postgres import AsyncSession
from polar.processor_transaction.repository import ProcessorTransactionRepository
from polar.processor_transaction.service import (
    processor_transaction as processor_transaction_service,
)


@pytest.mark.anyio
class TestSyncStripe:
    async def test_persists_raw_balance_transaction(
        self, session: AsyncSession, mocker: MockerFixture
    ) -> None:
        payload = {
            "id": "txn_test",
            "object": "balance_transaction",
            "created": 1_700_000_000,
            "type": "charge",
            "currency": "usd",
            "amount": 1000,
            "fee": 100,
            "description": None,
            "fee_details": [{"amount": 100, "currency": "usd", "type": "stripe_fee"}],
        }

        async def balance_transactions() -> AsyncIterator[stripe.BalanceTransaction]:
            yield stripe.BalanceTransaction.construct_from(payload, None)

        mocker.patch(
            "polar.processor_transaction.service.stripe_service.list_balance_transactions",
            return_value=balance_transactions(),
        )

        await processor_transaction_service.sync_stripe(session)
        await session.flush()
        session.expunge_all()

        repository = ProcessorTransactionRepository.from_session(session)
        (transaction,) = await repository.get_latest_by_processor(Processor.stripe)
        assert transaction.raw == payload

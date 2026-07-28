from datetime import timedelta
from functools import partial

import pytest

from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Account, Organization, Transaction, User
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.transaction.repository import (
    PayoutReversalTransactionRepository,
    TransactionRepository,
)
from scripts.backfill_payout_reversal_unpaid import run_backfill
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account

ten_days_ago = utc_now() - timedelta(days=10)
create_payment_transaction = partial(
    ro.create_payment_transaction, amount=10000, created_at=ten_days_ago
)
create_balance_transaction = partial(
    ro.create_balance_transaction, amount=10000, created_at=ten_days_ago
)


@pytest.mark.asyncio
class TestRunBackfill:
    async def _cancel_then_repay(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> tuple[Transaction, Transaction, Transaction]:
        await create_payout_account(save_fixture, organization, user)
        payment_transaction = await create_payment_transaction(save_fixture)
        await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction
        )

        first_payout = await payout_service.create(session, locker, organization)
        first_transaction = first_payout.transaction
        await payout_service.cancel(session, first_payout)
        second_payout = await payout_service.create(session, locker, organization)

        reversal_repository = PayoutReversalTransactionRepository.from_session(session)
        reversal = await reversal_repository.get_by_payout_id(first_payout.id)
        assert reversal is not None
        return reversal, first_transaction, second_payout.transaction

    async def test_dry_run_leaves_the_reversal_where_it_is(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        reversal, _, second_transaction = await self._cancel_then_repay(
            save_fixture, session, locker, organization, account, user
        )
        reversal_repository = PayoutReversalTransactionRepository.from_session(session)
        await reversal_repository.update(
            reversal, update_dict={"payout_transaction_id": second_transaction.id}
        )

        attributed = await run_backfill(session, execute=False)

        assert attributed == 0
        assert reversal.payout_transaction_id == second_transaction.id

    async def test_execute_repoints_and_restores_the_sum(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        reversal, first_transaction, second_transaction = await self._cancel_then_repay(
            save_fixture, session, locker, organization, account, user
        )
        reversal_repository = PayoutReversalTransactionRepository.from_session(session)
        await reversal_repository.update(
            reversal, update_dict={"payout_transaction_id": second_transaction.id}
        )

        attributed = await run_backfill(session, execute=True)

        assert attributed == 1
        await session.refresh(reversal)
        assert reversal.payout_transaction_id == first_transaction.id

        repository = TransactionRepository.from_session(session)
        paid_transactions = await repository.get_all_paid_transactions_by_payout(
            second_transaction.id
        )
        assert -second_transaction.amount == sum(t.amount for t in paid_transactions)

    async def test_attributes_a_reversal_left_unattributed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        reversal, first_transaction, _ = await self._cancel_then_repay(
            save_fixture, session, locker, organization, account, user
        )
        reversal_repository = PayoutReversalTransactionRepository.from_session(session)
        await reversal_repository.update(
            reversal, update_dict={"payout_transaction_id": None}
        )

        attributed = await run_backfill(session, execute=True)

        assert attributed == 1
        await session.refresh(reversal)
        assert reversal.payout_transaction_id == first_transaction.id

    async def test_attributes_every_reversal_across_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        await create_payout_account(save_fixture, organization, user)
        reversal_repository = PayoutReversalTransactionRepository.from_session(session)
        pairs: list[tuple[Transaction, Transaction]] = []
        for index in range(3):
            payment_transaction = await create_payment_transaction(
                save_fixture, charge_id=f"STRIPE_CHARGE_ID_{index}"
            )
            await create_balance_transaction(
                save_fixture, account=account, payment_transaction=payment_transaction
            )
            payout = await payout_service.create(session, locker, organization)
            await payout_service.cancel(session, payout)
            reversal = await reversal_repository.get_by_payout_id(payout.id)
            assert reversal is not None
            await reversal_repository.update(
                reversal, update_dict={"payout_transaction_id": None}
            )
            pairs.append((reversal, payout.transaction))

        attributed = await run_backfill(session, execute=True, batch_size=1)

        assert attributed == 3
        for reversal, payout_transaction in pairs:
            await session.refresh(reversal)
            assert reversal.payout_transaction_id == payout_transaction.id

    async def test_leaves_a_correctly_attributed_reversal_alone(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        reversal, first_transaction, _ = await self._cancel_then_repay(
            save_fixture, session, locker, organization, account, user
        )
        assert reversal.payout_transaction_id == first_transaction.id

        assert await run_backfill(session, execute=True) == 0

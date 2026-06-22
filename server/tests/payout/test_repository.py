import pytest

from polar.enums import PayoutAccountType
from polar.kit.utils import utc_now
from polar.models import Organization, User
from polar.models.payout import PayoutStatus
from polar.models.transaction import TransactionType
from polar.payout.repository import PayoutRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_payout,
    create_payout_account,
)
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestGetHeldCountsByAccounts:
    async def test_empty_input(self, session: AsyncSession) -> None:
        repository = PayoutRepository.from_session(session)
        assert await repository.get_held_counts_by_accounts([]) == {}

    async def test_counts_only_held_per_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        organization_second: Organization,
        user_second: User,
    ) -> None:
        account_1 = await create_account(save_fixture, user)
        payout_account_1 = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        account_2 = await create_account(save_fixture, user_second)
        payout_account_2 = await create_payout_account(
            save_fixture,
            organization_second,
            user_second,
            type=PayoutAccountType.stripe,
        )

        # account_1: two held + one pending (pending is excluded).
        await create_payout(
            save_fixture,
            account=account_1,
            payout_account=payout_account_1,
            status=PayoutStatus.held,
            attempts=[],
        )
        await create_payout(
            save_fixture,
            account=account_1,
            payout_account=payout_account_1,
            status=PayoutStatus.held,
            attempts=[],
        )
        await create_payout(
            save_fixture,
            account=account_1,
            payout_account=payout_account_1,
            status=PayoutStatus.pending,
            attempts=[],
        )
        # account_2: no held payout, only a succeeded one.
        await create_payout(
            save_fixture,
            account=account_2,
            payout_account=payout_account_2,
            status=PayoutStatus.succeeded,
        )

        repository = PayoutRepository.from_session(session)
        counts = await repository.get_held_counts_by_accounts(
            [account_1.id, account_2.id]
        )

        # account_2 has no held payout, so it's absent from the mapping.
        assert counts == {account_1.id: 2}

    async def test_soft_deleted_held_not_counted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        soft_deleted = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        soft_deleted.deleted_at = utc_now()
        await save_fixture(soft_deleted)

        repository = PayoutRepository.from_session(session)
        counts = await repository.get_held_counts_by_accounts([account.id])

        # Only the live held payout counts; the soft-deleted one is excluded.
        assert counts == {account.id: 1}


@pytest.mark.asyncio
class TestGetById:
    async def test_for_update(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # FOR UPDATE OF payouts must lock only the payout row so the eager-load
        # joins (account, payout_account, transactions) don't trip the
        # nullable-outer-join lock error. Exercises the real SQL on Postgres.
        account = await create_account(save_fixture, user)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture, account=account, payout_account=payout_account
        )
        await create_transaction(
            save_fixture,
            account=account,
            type=TransactionType.payout,
            amount=-payout.amount,
            account_currency=account.currency,
            payout=payout,
        )

        repository = PayoutRepository.from_session(session)
        locked = await repository.get_by_id(
            payout.id, options=repository.get_eager_options(), for_update=True
        )

        assert locked is not None
        assert locked.id == payout.id
        # Relationships resolve without a lazy load, confirming eager loading.
        assert locked.account.id == account.id
        assert locked.payout_account.id == payout_account.id

import uuid
from datetime import timedelta

import pytest

from polar.auth.models import AuthSubject
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import Account, Organization, Transaction, User, UserOrganization
from polar.models.transaction import PlatformFeeType, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestSearch:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_no_access(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        all_transactions: list[Transaction],
    ) -> None:
        results, count = await transaction_service.search(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(results) == 0

    @pytest.mark.auth
    async def test_no_filter(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        results, count = await transaction_service.search(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == len(readable_user_transactions)
        assert len(results) == len(readable_user_transactions)

        readable_user_transactions_id = [t.id for t in readable_user_transactions]

        for result in results:
            assert result.id in readable_user_transactions_id
            # Check that relationships are eagerly loaded
            result.issue_reward
            result.order
            if result.order is not None:
                result.order.product

    @pytest.mark.auth
    async def test_filter_type(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        account: Account,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            auth_subject,
            type=TransactionType.payout,
            pagination=PaginationParams(1, 10),
        )

        payout_transactions_id = [
            t.id for t in readable_user_transactions if t.type == TransactionType.payout
        ]

        assert count == len(payout_transactions_id)
        assert len(results) == len(payout_transactions_id)

        for result in results:
            assert result.id in payout_transactions_id

    @pytest.mark.auth
    async def test_filter_account(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            auth_subject,
            account_id=account.id,
            pagination=PaginationParams(1, 10),
        )

        assert count == len(account_transactions)
        assert len(results) == len(account_transactions)

        account_transactions_id = [t.id for t in account_transactions]

        for result in results:
            assert result.id in account_transactions_id

    @pytest.mark.auth
    async def test_filter_payment_user(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            auth_subject,
            payment_user_id=user.id,
            pagination=PaginationParams(1, 10),
        )

        assert count == len(user_transactions)
        assert len(results) == len(user_transactions)

        user_transactions_id = [t.id for t in user_transactions]

        for result in results:
            assert result.id in user_transactions_id

    @pytest.mark.auth
    async def test_filter_payment_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        organization_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            auth_subject,
            payment_organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert count == len(organization_transactions)
        assert len(results) == len(organization_transactions)

        organization_transactions_id = [t.id for t in organization_transactions]

        for result in results:
            assert result.id in organization_transactions_id


@pytest.mark.asyncio
class TestGetSummary:
    async def test_no_transaction(
        self, session: AsyncSession, account: Account
    ) -> None:
        summary = await transaction_service.get_summary(session, account)

        assert summary.balance.currency == "usd"
        assert summary.balance.account_currency == account.currency
        assert summary.balance.amount == 0
        assert summary.balance.account_amount == 0

        assert summary.payout.currency == "usd"
        assert summary.payout.account_currency == account.currency
        assert summary.payout.amount == 0
        assert summary.payout.account_amount == 0

        assert summary.held_balance.amount == 0
        assert summary.held_balance.account_amount == 0
        assert summary.held_balance.next_release_at is None
        assert summary.held_balance.next_release_amount == 0
        assert summary.held_balance.fully_available_at is None

    async def test_valid(
        self, session: AsyncSession, save_fixture: SaveFixture, account: Account
    ) -> None:
        now = utc_now()

        # Create an old balance transaction (8 days ago - should be available)
        # Using account_currency="usd" so account_amount = amount
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=1000,
            currency="usd",
            account_currency="usd",
            created_at=now - timedelta(days=8),
        )

        # Create a recent balance transaction (2 days ago - should NOT be available)
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=500,
            currency="usd",
            account_currency="usd",
            created_at=now - timedelta(days=2),
        )

        # Create a payout transaction (2 days ago - should ALWAYS be available)
        await create_transaction(
            save_fixture,
            type=TransactionType.payout,
            account=account,
            amount=-2000,
            currency="usd",
            account_currency="usd",
            created_at=now - timedelta(days=2),
        )

        # Create a payout fee (2 days ago - should ALWAYS be available)
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=-100,
            currency="usd",
            account_currency="usd",
            created_at=now - timedelta(days=2),
            platform_fee_type=PlatformFeeType.payout,
        )

        summary = await transaction_service.get_summary(session, account)

        # Total balance should include all transactions
        assert summary.balance.amount == 1000 + 500 - 2000 - 100
        assert summary.balance.account_amount == 1000 + 500 - 2000 - 100

        # Available balance should exclude recent non-payout transactions
        # old_balance (1000) + payout (-2000) = -1000
        # recent_balance (500) is excluded because it's only 2 days old (< 7 days)
        assert summary.available_balance.amount == 1000 - 2000 - 100
        assert summary.available_balance.account_amount == 1000 - 2000 - 100

        # Payout balance should include all payouts
        assert summary.payout.amount == -2000
        assert summary.payout.account_amount == -2000

        assert summary.held_balance.amount == 500
        assert summary.held_balance.account_amount == 500
        assert summary.held_balance.next_release_amount == 500
        assert summary.held_balance.next_release_at == now + timedelta(days=5)
        assert summary.held_balance.fully_available_at == now + timedelta(days=5)

    async def test_held_release_schedule(
        self, session: AsyncSession, save_fixture: SaveFixture, account: Account
    ) -> None:
        now = utc_now()

        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=1000,
            account_currency="usd",
            created_at=now - timedelta(days=10),
        )
        for amount in (300, 200):
            await create_transaction(
                save_fixture,
                type=TransactionType.balance,
                account=account,
                amount=amount,
                account_currency="usd",
                created_at=now - timedelta(days=5),
            )
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=-100,
            account_currency="usd",
            created_at=now - timedelta(days=3),
        )

        summary = await transaction_service.get_summary(session, account)

        assert summary.held_balance.amount == 400
        assert summary.held_balance.next_release_amount == 500
        assert summary.held_balance.next_release_at == now + timedelta(days=2)
        assert summary.held_balance.fully_available_at == now + timedelta(days=4)

    async def test_held_negative_release_skipped(
        self, session: AsyncSession, save_fixture: SaveFixture, account: Account
    ) -> None:
        now = utc_now()

        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=-100,
            account_currency="usd",
            created_at=now - timedelta(days=6),
        )
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=500,
            account_currency="usd",
            created_at=now - timedelta(days=2),
        )

        summary = await transaction_service.get_summary(session, account)

        assert summary.held_balance.amount == 400
        assert summary.held_balance.next_release_amount == 500
        assert summary.held_balance.next_release_at == now + timedelta(days=5)
        assert summary.held_balance.fully_available_at == now + timedelta(days=5)

    async def test_held_negative_only(
        self, session: AsyncSession, save_fixture: SaveFixture, account: Account
    ) -> None:
        now = utc_now()

        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            amount=-100,
            account_currency="usd",
            created_at=now - timedelta(days=2),
        )

        summary = await transaction_service.get_summary(session, account)

        assert summary.held_balance.amount == -100
        assert summary.held_balance.next_release_at is None
        assert summary.held_balance.next_release_amount == 0
        assert summary.held_balance.fully_available_at == now + timedelta(days=5)


@pytest.mark.asyncio
class TestLookup:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_not_existing(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(session, uuid.uuid4(), auth_subject)

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_user_not_accessible(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(
                session, readable_user_transactions[0].id, auth_subject
            )

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        transaction = await transaction_service.lookup(
            session, readable_user_transactions[0].id, auth_subject
        )

        assert transaction.id == readable_user_transactions[0].id
        # Check that relationships are eagerly loaded
        transaction.pledge
        transaction.issue_reward
        transaction.order

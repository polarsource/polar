import uuid

import pytest

from polar.authz.service import Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.models import Account, Pledge, Transaction, User, UserOrganization
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_account_not_permitted(
        self, session: AsyncSession, account: Account, user_second: User, authz: Authz
    ) -> None:
        with pytest.raises(NotPermitted):
            await transaction_service.search(
                session, user_second, account, authz, pagination=PaginationParams(1, 10)
            )

    async def test_valid(
        self,
        session: AsyncSession,
        account: Account,
        user: User,
        user_organization: UserOrganization,
        pledge: Pledge,
        account_transactions: list[Transaction],
        authz: Authz,
    ) -> None:
        session.expunge_all()

        results, count = await transaction_service.search(
            session, user, account, authz, pagination=PaginationParams(1, 10)
        )

        assert count == len(account_transactions)
        assert len(results) == len(account_transactions)

        for result in results:
            # Check that relationships are eagerly loaded
            result.pledge
            if result.pledge is not None:
                result.pledge.issue
            result.issue_reward
            result.subscription
            if result.subscription is not None:
                result.subscription.subscription_tier


@pytest.mark.asyncio
class TestGetSummary:
    async def test_account_not_permitted(
        self, session: AsyncSession, account: Account, user_second: User, authz: Authz
    ) -> None:
        with pytest.raises(NotPermitted):
            await transaction_service.get_summary(session, user_second, account, authz)

    async def test_valid(
        self,
        session: AsyncSession,
        account: Account,
        user: User,
        user_organization: UserOrganization,
        authz: Authz,
        account_transactions: list[Transaction],
    ) -> None:
        summary = await transaction_service.get_summary(session, user, account, authz)

        assert summary.balance.currency == "usd"
        assert summary.balance.account_currency == "eur"
        assert summary.balance.amount == sum(t.amount for t in account_transactions)
        assert summary.balance.account_amount == sum(
            t.account_amount for t in account_transactions
        )

        assert summary.payout.currency == "usd"
        assert summary.payout.account_currency == "eur"
        assert summary.payout.amount == sum(
            t.amount for t in account_transactions if t.type == TransactionType.payout
        )
        assert summary.payout.account_amount == sum(
            t.account_amount
            for t in account_transactions
            if t.type == TransactionType.payout
        )


@pytest.mark.asyncio
class TestLookup:
    async def test_not_existing(
        self, session: AsyncSession, user_second: User, authz: Authz
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(session, uuid.uuid4(), user_second, authz)

    async def test_account_not_permitted(
        self,
        session: AsyncSession,
        account: Account,
        user_second: User,
        authz: Authz,
        account_transactions: list[Transaction],
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(
                session, account_transactions[0].id, user_second, authz
            )

    async def test_valid(
        self,
        session: AsyncSession,
        user: User,
        authz: Authz,
        account_transactions: list[Transaction],
        account: Account,
        user_organization: UserOrganization,
    ) -> None:
        transaction = await transaction_service.lookup(
            session, account_transactions[0].id, user, authz
        )

        assert transaction.id == account_transactions[0].id
        assert transaction.account is not None
        # Check that relationships are eagerly loaded
        transaction.pledge
        transaction.issue_reward
        transaction.subscription

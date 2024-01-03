import uuid

import pytest

from polar.authz.service import Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.models import Account, Organization, Transaction, User, UserOrganization
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_no_access(
        self,
        session: AsyncSession,
        user_second: User,
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session, user_second, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(results) == 0

    async def test_no_filter(
        self,
        session: AsyncSession,
        user: User,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == len(readable_user_transactions)
        assert len(results) == len(readable_user_transactions)

        readable_user_transactions_id = [t.id for t in readable_user_transactions]

        for result in results:
            assert result.id in readable_user_transactions_id
            # Check that relationships are eagerly loaded
            result.pledge
            if result.pledge is not None:
                result.pledge.issue
            result.issue_reward
            result.subscription
            if result.subscription is not None:
                result.subscription.subscription_tier

    async def test_filter_type(
        self,
        session: AsyncSession,
        account: Account,
        user: User,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            user,
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

    async def test_filter_account(
        self,
        session: AsyncSession,
        user: User,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session, user, account_id=account.id, pagination=PaginationParams(1, 10)
        )

        assert count == len(account_transactions)
        assert len(results) == len(account_transactions)

        account_transactions_id = [t.id for t in account_transactions]

        for result in results:
            assert result.id in account_transactions_id

    async def test_filter_payment_user(
        self,
        session: AsyncSession,
        user: User,
        user_organization: UserOrganization,
        user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session, user, payment_user_id=user.id, pagination=PaginationParams(1, 10)
        )

        assert count == len(user_transactions)
        assert len(results) == len(user_transactions)

        user_transactions_id = [t.id for t in user_transactions]

        for result in results:
            assert result.id in user_transactions_id

    async def test_filter_payment_organization(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        organization_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await transaction_service.search(
            session,
            user,
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
    async def test_account_not_permitted(
        self, session: AsyncSession, account: Account, user_second: User, authz: Authz
    ) -> None:
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
    async def test_not_existing(self, session: AsyncSession, user_second: User) -> None:
        # then
        session.expunge_all()

        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(session, uuid.uuid4(), user_second)

    async def test_user_not_accessible(
        self,
        session: AsyncSession,
        user_second: User,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(ResourceNotFound):
            await transaction_service.lookup(
                session, readable_user_transactions[0].id, user_second
            )

    async def test_valid(
        self,
        session: AsyncSession,
        user: User,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        # then
        session.expunge_all()

        transaction = await transaction_service.lookup(
            session, readable_user_transactions[0].id, user
        )

        assert transaction.id == readable_user_transactions[0].id
        # Check that relationships are eagerly loaded
        transaction.pledge
        transaction.issue_reward
        transaction.subscription

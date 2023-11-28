import uuid

import pytest
from httpx import AsyncClient

from polar.models import Account, Pledge, Transaction, UserOrganization
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestSearchTransactions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/search", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/search", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/api/v1/transactions/search", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(account_transactions)

    @pytest.mark.authenticated
    async def test_filter_type(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/api/v1/transactions/search",
            params={"account_id": str(account.id), "type": TransactionType.payout},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(
            [t for t in account_transactions if t.type == TransactionType.payout]
        )


@pytest.mark.asyncio
class TestLookupTransaction:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/lookup", params={"transaction_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_transaction_payout(
        self,
        session: AsyncSession,
        account: Account,
        user_organization: UserOrganization,
        pledge: Pledge,
        client: AsyncClient,
    ) -> None:
        transaction = await create_transaction(
            session, type=TransactionType.payout, account=account, pledge=pledge
        )

        paid_transactions = [
            await create_transaction(
                session, account=account, payout_transaction=transaction
            ),
            await create_transaction(
                session, account=account, payout_transaction=transaction
            ),
            await create_transaction(
                session, account=account, payout_transaction=transaction
            ),
        ]

        response = await client.get(
            "/api/v1/transactions/lookup",
            params={"transaction_id": str(transaction.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(transaction.id)
        assert len(json["paid_transactions"]) == len(paid_transactions)


@pytest.mark.asyncio
class TestGetSummary:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200

        json = response.json()
        assert "balance" in json
        assert "payout" in json

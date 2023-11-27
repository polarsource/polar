import uuid

import pytest
from httpx import AsyncClient

from polar.models import Account, Transaction, UserOrganization


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

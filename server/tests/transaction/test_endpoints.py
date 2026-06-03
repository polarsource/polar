import uuid

import pytest
from httpx import AsyncClient

from polar.models import Account, Transaction, UserOrganization
from polar.models.user_organization import OrganizationRole
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestSearchTransactions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/transactions/search")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        response = await client.get("/v1/transactions/search")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(readable_user_transactions)


@pytest.mark.asyncio
class TestGetSummary:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_member_without_finance_read(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        account: Account,
        user_organization_second: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        # A regular member (no `finance:read` permission) must not be able to
        # access the financial summary of the org's account.
        user_organization_second.role = OrganizationRole.member
        await save_fixture(user_organization_second)

        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200

        json = response.json()
        assert "balance" in json
        assert "payout" in json

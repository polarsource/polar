import uuid

import pytest
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.models import Account, Organization, Transaction, User, UserOrganization
from polar.models.user_organization import OrganizationRole
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.transaction.conftest import create_transaction


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

    @pytest.mark.auth
    async def test_organization_scoped_session(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Member (admin → finance:read) of the second org too.
        await save_fixture(
            UserOrganization(
                user=user,
                organization=organization_second,
                role=OrganizationRole.admin,
            )
        )
        transaction = await create_transaction(
            save_fixture, payment_organization=organization
        )
        transaction_second = await create_transaction(
            save_fixture, payment_organization=organization_second
        )

        # Unscoped session sees both organizations' transactions.
        response = await client.get("/v1/transactions/search")
        assert response.status_code == 200
        ids = {item["id"] for item in response.json()["items"]}
        assert {str(transaction.id), str(transaction_second.id)} <= ids

        # Down-scoping the session to one org hides the other org's transactions.
        auth_subject.organization_ids = frozenset({organization.id})
        response = await client.get("/v1/transactions/search")
        assert response.status_code == 200
        ids = {item["id"] for item in response.json()["items"]}
        assert str(transaction.id) in ids
        assert str(transaction_second.id) not in ids


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

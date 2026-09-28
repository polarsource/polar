import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.models import User
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account


@pytest_asyncio.fixture
async def account_other_user(save_fixture: SaveFixture, user_second: User) -> Account:
    return await create_account(save_fixture, user_second)


@pytest.mark.asyncio
class TestGetAccount:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes=READ_ONLY_SCOPES),
        AuthSubjectFixture(scopes={Scope.transactions_read}),
        AuthSubjectFixture(scopes={Scope.payouts_read}),
        AuthSubjectFixture(scopes={Scope.transactions_write}),
        AuthSubjectFixture(scopes={Scope.payouts_write}),
    )
    async def test_read(
        self,
        client: AsyncClient,
        account: Account,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/accounts/{account.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(account.id)

    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/accounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_user_account(
        self,
        client: AsyncClient,
        account_other_user: Account,
    ) -> None:
        response = await client.get(f"/v1/accounts/{account_other_user.id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetAccountCredits:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/accounts/{uuid.uuid4()}/credits")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_user_account(
        self,
        client: AsyncClient,
        account_other_user: Account,
    ) -> None:
        response = await client.get(f"/v1/accounts/{account_other_user.id}/credits")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestPatchAccount:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes=READ_ONLY_SCOPES),
        AuthSubjectFixture(scopes={Scope.transactions_read}),
        AuthSubjectFixture(scopes={Scope.payouts_read}),
    )
    async def test_read_only_cannot_update(
        self,
        client: AsyncClient,
        account: Account,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/accounts/{account.id}",
            json={"billing_name": "John Doe", "billing_notes": "Updated note"},
        )

        assert response.status_code == 403

    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/accounts/{uuid.uuid4()}", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_update_other_user_account(
        self,
        client: AsyncClient,
        account_other_user: Account,
    ) -> None:
        response = await client.patch(
            f"/v1/accounts/{account_other_user.id}",
            json={"billing_name": "John Doe"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(),
        AuthSubjectFixture(scopes={Scope.transactions_write}),
        AuthSubjectFixture(scopes={Scope.payouts_write}),
    )
    async def test_update(
        self,
        account: Account,
        organization: Organization,
        user_organization: UserOrganization,
        client: AsyncClient,
    ) -> None:
        response = await client.patch(
            f"/v1/accounts/{account.id}",
            json={
                "billing_name": "John Doe",
                "billing_address": {
                    "line1": "123 Main St",
                    "postal_code": "10001",
                    "city": "New York",
                    "state": "NY",
                    "country": "US",
                },
                "billing_notes": "This is a test billing note.",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["billing_name"] == "John Doe"
        assert json["billing_address"]["city"] == "New York"
        assert json["billing_notes"] == "This is a test billing note."

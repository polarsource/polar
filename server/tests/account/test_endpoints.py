import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import User
from polar.models.account import Account
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account


@pytest_asyncio.fixture
async def account_other_user(save_fixture: SaveFixture, user_second: User) -> Account:
    return await create_account(save_fixture, user_second)


@pytest.mark.asyncio
class TestGetAccount:
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


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update(account: Account, client: AsyncClient) -> None:
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

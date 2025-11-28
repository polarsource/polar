import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Customer, Wallet
from polar.models.wallet import WalletType
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_wallet


@pytest_asyncio.fixture
async def wallets(save_fixture: SaveFixture, customer: Customer) -> list[Wallet]:
    return [await create_wallet(save_fixture, type=WalletType.usage, customer=customer)]


@pytest.mark.asyncio
class TestListWallets:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-portal/wallets/")

        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_empty(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-portal/wallets/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid(self, client: AsyncClient, wallets: list[Wallet]) -> None:
        response = await client.get("/v1/customer-portal/wallets/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(wallets)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_other_customer_wallet(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer_second: Customer,
    ) -> None:
        await create_wallet(
            save_fixture, type=WalletType.usage, customer=customer_second
        )

        response = await client.get("/v1/customer-portal/wallets/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetWallet:
    async def test_anonymous(self, client: AsyncClient, wallets: list[Wallet]) -> None:
        response = await client.get(f"/v1/customer-portal/wallets/{wallets[0].id}")

        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/customer-portal/wallets/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_other_customer_wallet(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer_second: Customer,
    ) -> None:
        wallet = await create_wallet(
            save_fixture, type=WalletType.usage, customer=customer_second
        )

        response = await client.get(f"/v1/customer-portal/wallets/{wallet.id}")

        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid(self, client: AsyncClient, wallets: list[Wallet]) -> None:
        response = await client.get(f"/v1/customer-portal/wallets/{wallets[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(wallets[0].id)
        assert json["balance"] == 0

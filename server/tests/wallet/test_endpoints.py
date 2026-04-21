import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Customer, Order, UserOrganization, Wallet
from polar.models.wallet import WalletType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_wallet


@pytest_asyncio.fixture
async def wallets(save_fixture: SaveFixture, customer: Customer) -> list[Wallet]:
    return [await create_wallet(save_fixture, type=WalletType.usage, customer=customer)]


@pytest_asyncio.fixture
async def wallet_organization_second(
    save_fixture: SaveFixture,
    customer_organization_second: Customer,
) -> Wallet:
    return await create_wallet(
        save_fixture, type=WalletType.usage, customer=customer_organization_second
    )


@pytest.mark.asyncio
class TestListWallets:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/wallets/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, wallets: list[Wallet]
    ) -> None:
        response = await client.get("/v1/wallets/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.wallets_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        wallets: list[Wallet],
    ) -> None:
        response = await client.get("/v1/wallets/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(wallets)


@pytest.mark.asyncio
class TestGetWallet:
    async def test_anonymous(self, client: AsyncClient, wallets: list[Wallet]) -> None:
        response = await client.get(f"/v1/wallets/{wallets[0].id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/wallets/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, wallets: list[Wallet]
    ) -> None:
        response = await client.get(f"/v1/wallets/{wallets[0].id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.wallets_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        wallets: list[Wallet],
    ) -> None:
        response = await client.get(f"/v1/wallets/{wallets[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(wallets[0].id)
        assert json["balance"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.wallets_read}),
    )
    async def test_organization(
        self, client: AsyncClient, wallets: list[Order]
    ) -> None:
        response = await client.get(f"/v1/wallets/{wallets[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(wallets[0].id)
        assert json["balance"] == 0


@pytest.mark.asyncio
class TestTopUpWallet:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/wallets/{uuid.uuid4()}/top-up", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_top_up_other_organization_wallet(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        wallet_organization_second: Wallet,
    ) -> None:
        response = await client.post(
            f"/v1/wallets/{wallet_organization_second.id}/top-up",
            json={"amount": 1000, "currency": "usd"},
        )

        assert response.status_code == 404

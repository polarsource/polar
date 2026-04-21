import uuid

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Organization, Payout, User, UserOrganization
from polar.models.transaction import TransactionType
from polar.payout.endpoints import payout_service  # type: ignore[attr-defined]
from polar.payout.service import PayoutService
from polar.postgres import AsyncSession, get_db_sessionmaker
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_payout,
    create_payout_account,
)
from tests.transaction.conftest import create_transaction


@pytest_asyncio.fixture
async def payout_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
    user_second: User,
) -> Payout:
    account = await create_account(save_fixture, user_second)
    organization_second.account = account
    await save_fixture(organization_second)
    payout_account = await create_payout_account(
        save_fixture, organization_second, user_second
    )
    transaction = await create_transaction(
        save_fixture, account=account, type=TransactionType.payout
    )
    return await create_payout(
        save_fixture,
        account=account,
        payout_account=payout_account,
        transaction=transaction,
    )


@pytest.mark.asyncio
class TestList:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/payouts/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_payouts(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_organization_second: Payout,
    ) -> None:
        response = await client.get("/v1/payouts/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetEstimate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/payouts/estimate", params={"organization_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        client: AsyncClient,
        organization_second: Organization,
    ) -> None:
        response = await client.get(
            "/v1/payouts/estimate",
            params={"organization_id": str(organization_second.id)},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetCSV:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payouts/{uuid.uuid4()}/csv")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_payout(
        self,
        app: FastAPI,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_organization_second: Payout,
    ) -> None:
        # The CSV endpoint depends on `get_db_sessionmaker`, which the test
        # harness doesn't provide. The authz check raises before the
        # sessionmaker is used, so a stub override is sufficient to let the
        # dependency resolve.
        app.dependency_overrides[get_db_sessionmaker] = lambda: None
        try:
            response = await client.get(
                f"/v1/payouts/{payout_organization_second.id}/csv"
            )
        finally:
            app.dependency_overrides.pop(get_db_sessionmaker)

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGenerateInvoice:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/payouts/{uuid.uuid4()}/invoice", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_payout(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_organization_second: Payout,
    ) -> None:
        response = await client.post(
            f"/v1/payouts/{payout_organization_second.id}/invoice",
            json={"invoice_number": "INV-001"},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetInvoice:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payouts/{uuid.uuid4()}/invoice")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_payout(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_organization_second: Payout,
    ) -> None:
        response = await client.get(
            f"/v1/payouts/{payout_organization_second.id}/invoice"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/payouts/", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/payouts/", json={"organization_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_permitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_second: User,
    ) -> None:
        organization.account = await create_account(save_fixture, user_second)
        await save_fixture(organization)

        response = await client.post(
            "/v1/payouts/", json={"organization_id": str(organization.id)}
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        account = await create_account(save_fixture, user_organization.user)
        organization.account = account
        await save_fixture(organization)

        payout_account = await create_payout_account(
            save_fixture, organization, user_organization.user
        )
        transaction = await create_transaction(
            save_fixture, account=account, type=TransactionType.payout
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            transaction=transaction,
        )

        mocker.patch.object(
            payout_service,
            "create",
            spec=PayoutService.create,
            return_value=payout,
        )

        response = await client.post(
            "/v1/payouts/", json={"organization_id": str(organization.id)}
        )

        assert response.status_code == 201

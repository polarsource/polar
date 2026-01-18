import uuid

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Organization, User, UserOrganization
from polar.models.transaction import TransactionType
from polar.payout.endpoints import payout_service
from polar.payout.service import PayoutService
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account, create_payout
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/payouts/", json={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/payouts/", json={"account_id": str(uuid.uuid4())}
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
        account = await create_account(save_fixture, organization, user_second)
        response = await client.post(
            "/v1/payouts/", json={"account_id": str(account.id)}
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
    ) -> None:
        account = await create_account(
            save_fixture, user_organization.organization, user_organization.user
        )
        transaction = await create_transaction(
            save_fixture, account=account, type=TransactionType.payout
        )
        payout = await create_payout(
            save_fixture, account=account, transaction=transaction
        )

        mocker.patch.object(
            payout_service,
            "create",
            spec=PayoutService.create,
            return_value=payout,
        )

        response = await client.post(
            "/v1/payouts/", json={"account_id": str(account.id)}
        )

        assert response.status_code == 201

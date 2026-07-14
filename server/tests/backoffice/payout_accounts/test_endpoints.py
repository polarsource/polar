import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import Organization, PayoutAccount, User
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestList:
    async def test_lists_payout_account(
        self,
        backoffice_client: httpx.AsyncClient,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        response = await backoffice_client.get("/payout-accounts/")

        assert response.status_code == 200
        assert str(stripe_payout_account.id) in response.text

    async def test_search_by_email(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, stripe_id="acct_findme"
        )
        payout_account.email = "match@example.com"
        await save_fixture(payout_account)

        response = await backoffice_client.get(
            "/payout-accounts/", params={"query": "match@example.com"}
        )

        assert response.status_code == 200
        assert str(payout_account.id) in response.text

    async def test_search_by_stripe_id(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, stripe_id="acct_unique_123"
        )

        response = await backoffice_client.get(
            "/payout-accounts/", params={"query": "acct_unique_123"}
        )

        assert response.status_code == 200
        assert str(payout_account.id) in response.text

    async def test_search_by_organization_id(
        self,
        backoffice_client: httpx.AsyncClient,
        stripe_payout_account: PayoutAccount,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.get(
            "/payout-accounts/", params={"query": str(organization.id)}
        )

        assert response.status_code == 200
        assert str(stripe_payout_account.id) in response.text


@pytest.mark.asyncio
class TestGet:
    async def test_returns_404_for_unknown_id(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(f"/payout-accounts/{uuid.uuid4()}")

        assert response.status_code == 404

    async def test_shows_payout_account_details(
        self,
        backoffice_client: httpx.AsyncClient,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        response = await backoffice_client.get(
            f"/payout-accounts/{stripe_payout_account.id}"
        )

        assert stripe_payout_account.stripe_id is not None
        assert response.status_code == 200
        assert str(stripe_payout_account.id) in response.text
        assert stripe_payout_account.stripe_id in response.text


@pytest.mark.asyncio
class TestDelete:
    async def test_returns_404_for_unknown_id(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            f"/payout-accounts/{uuid.uuid4()}/delete"
        )

        assert response.status_code == 404

    async def test_get_renders_confirmation_modal(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, stripe_id="acct_todelete"
        )

        response = await backoffice_client.get(
            f"/payout-accounts/{payout_account.id}/delete"
        )

        assert response.status_code == 200
        assert "Delete Payout Account" in response.text

    async def test_post_deletes_payout_account(
        self,
        backoffice_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, stripe_id="acct_todelete"
        )

        stripe_mock = mocker.patch("polar.payout_account.service.stripe")
        stripe_mock.account_exists = mocker.AsyncMock(return_value=True)
        stripe_mock.retrieve_balance = mocker.AsyncMock(return_value=(0, 0))
        stripe_mock.delete_account = mocker.AsyncMock(return_value=None)

        response = await backoffice_client.post(
            f"/payout-accounts/{payout_account.id}/delete",
            data={"reason": "Merchant closed account"},
        )

        assert response.status_code in (200, 303)
        stripe_mock.delete_account.assert_awaited_once_with(payout_account.stripe_id)

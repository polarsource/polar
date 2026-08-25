import re
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.enums import PayoutAccountType
from polar.models import Account, Organization, User
from polar.models.payout import PayoutStatus
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout, create_payout_account


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
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
    async def test_status_filter_keeps_selected_status(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            "/payouts/", params={"status": PayoutStatus.pending.value}
        )

        assert response.status_code == 200
        assert re.search(
            r'<option(?=[^>]*value="pending")(?=[^>]*selected)[^>]*>\s*Pending\s*</option>',
            response.text,
        )


@pytest.mark.asyncio
class TestMarkPaid:
    async def test_button_and_confirmation(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.manual
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )

        response = await backoffice_client.get(f"/payouts/{payout.id}")

        assert response.status_code == 200
        assert "Mark as Paid" in response.text

        response = await backoffice_client.get(f"/payouts/{payout.id}/mark-paid")

        assert response.status_code == 200
        assert "This will create a successful manual payout attempt." in response.text

    async def test_post_creates_succeeded_attempt(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.manual
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )

        response = await backoffice_client.post(f"/payouts/{payout.id}/mark-paid")

        assert response.status_code == 200
        assert f"/payouts/{payout.id}" in response.text

        await session.refresh(payout, attribute_names=["status", "attempts"])
        assert payout.status == PayoutStatus.succeeded
        assert len(payout.attempts) == 1
        attempt = payout.attempts[0]
        assert attempt.status == PayoutAttemptStatus.succeeded
        assert attempt.paid_at is not None

    async def test_stripe_payout_has_no_button(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.pending,
            attempts=[],
        )

        response = await backoffice_client.get(f"/payouts/{payout.id}")

        assert response.status_code == 200
        assert "Mark as Paid" not in response.text

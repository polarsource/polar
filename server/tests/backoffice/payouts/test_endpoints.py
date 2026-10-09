import re
from collections.abc import AsyncGenerator

import httpx
import pytest
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.enums import PayoutAccountType
from polar.models import Account, Organization, User
from polar.models.organization import OrganizationStatus
from polar.models.payout import PayoutStatus
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout, create_payout_account


@pytest.fixture
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


@pytest.mark.anyio
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


@pytest.mark.anyio
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


@pytest.mark.anyio
class TestGet:
    async def test_manual_pending_shows_mark_as_paid_not_retry(
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
        assert "Retry Payout" not in response.text

    async def test_stripe_pending_shows_retry_button(
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
        assert "Retry Payout" in response.text
        assert "Mark as Paid" not in response.text


@pytest.mark.anyio
class TestRetry:
    async def test_get_manual_payout_returns_400(
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

        response = await backoffice_client.get(f"/payouts/{payout.id}/retry")

        assert response.status_code == 400

    async def test_post_manual_payout_returns_400_and_does_not_enqueue(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
        mocker: MockerFixture,
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
        enqueue_job_mock = mocker.patch(
            "polar.backoffice.payouts.endpoints.enqueue_job"
        )

        response = await backoffice_client.post(f"/payouts/{payout.id}/retry", data={})

        assert response.status_code == 400
        enqueue_job_mock.assert_not_called()

    async def test_get_stripe_payout_shows_confirmation(
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

        response = await backoffice_client.get(f"/payouts/{payout.id}/retry")

        assert response.status_code == 200
        assert f"Retry Payout {payout.id}" in response.text

    async def test_post_stripe_payout_enqueues_task(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
        mocker: MockerFixture,
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
        enqueue_job_mock = mocker.patch(
            "polar.backoffice.payouts.endpoints.enqueue_job"
        )

        response = await backoffice_client.post(f"/payouts/{payout.id}/retry", data={})

        assert response.status_code == 200
        assert f"/payouts/{payout.id}" in response.text
        enqueue_job_mock.assert_called_once_with(
            "payout.trigger_stripe_payout",
            payout_id=payout.id,
            account_amount=None,
        )


@pytest.mark.anyio
class TestPayOut:
    async def test_held_shows_button_and_confirmation(
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
            status=PayoutStatus.held,
            attempts=[],
        )

        response = await backoffice_client.get(f"/payouts/{payout.id}")

        assert response.status_code == 200
        assert "Pay Out" in response.text
        assert "Retry Payout" not in response.text

        response = await backoffice_client.get(f"/payouts/{payout.id}/pay-out")

        assert response.status_code == 200
        assert "without approving the organization" in response.text
        assert "Leave the organization in its current status" in response.text
        assert "Start the transfer for this payout only" in response.text

    async def test_manual_confirmation_stays_pending(
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
            status=PayoutStatus.held,
            attempts=[],
        )

        response = await backoffice_client.get(f"/payouts/{payout.id}/pay-out")

        assert response.status_code == 200
        assert "marked as paid" in response.text

    async def test_pending_hides_button(
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
        assert "Pay Out" not in response.text

        response = await backoffice_client.get(f"/payouts/{payout.id}/pay-out")

        assert response.status_code == 409
        assert "is not held" in response.text

    async def test_post_releases_one_payout_and_leaves_org_under_review(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        account: Account,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        await save_fixture(organization)
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        held = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        other_held = await create_payout(
            save_fixture,
            account=account,
            payout_account=payout_account,
            status=PayoutStatus.held,
            attempts=[],
        )
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        response = await backoffice_client.post(f"/payouts/{held.id}/pay-out")

        assert response.status_code == 200
        assert f"/payouts/{held.id}" in response.text
        enqueue_job_mock.assert_called_once_with("payout.transfer", payout_id=held.id)

        await session.refresh(held, attribute_names=["status"])
        await session.refresh(other_held, attribute_names=["status"])
        await session.refresh(organization, attribute_names=["status"])
        assert held.status == PayoutStatus.pending
        assert other_held.status == PayoutStatus.held
        assert organization.status == OrganizationStatus.REVIEW

    async def test_post_pending_does_not_enqueue(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
        mocker: MockerFixture,
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
        enqueue_job_mock = mocker.patch("polar.payout.service.enqueue_job")

        response = await backoffice_client.post(f"/payouts/{payout.id}/pay-out")

        assert response.status_code == 409
        enqueue_job_mock.assert_not_called()

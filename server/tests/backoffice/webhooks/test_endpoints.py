import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import Organization, User, WebhookEndpoint
from polar.models.user_session import UserSession
from polar.models.webhook_endpoint import WebhookFormat
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture


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
class TestToggleEnabled:
    async def test_toggle_unknown_endpoint_returns_404(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.post(
            f"/webhooks/{uuid.uuid4()}/toggle-enabled"
        )

        assert response.status_code == 404

    async def test_enable_with_valid_url_succeeds(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://example.com/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=False,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert "Webhook enabled successfully" in response.text
        await session.refresh(endpoint)
        assert endpoint.enabled is True

    async def test_disable_with_valid_url_succeeds(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://example.com/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=True,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert "Webhook disabled successfully" in response.text
        await session.refresh(endpoint)
        assert endpoint.enabled is False

    async def test_reject_enable_with_localhost_url(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://127.0.0.1/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=False,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert (
            "Cannot enable a webhook with a localhost or private IP URL"
            in response.text
        )
        assert "alert-error" in response.text
        await session.refresh(endpoint)
        assert endpoint.enabled is False

    async def test_reject_enable_with_private_ip_url(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://10.0.0.1/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=False,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert (
            "Cannot enable a webhook with a localhost or private IP URL"
            in response.text
        )
        await session.refresh(endpoint)
        assert endpoint.enabled is False

    async def test_reject_enable_with_ipv6_loopback_url(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://[::1]/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=False,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert (
            "Cannot enable a webhook with a localhost or private IP URL"
            in response.text
        )
        await session.refresh(endpoint)
        assert endpoint.enabled is False

    async def test_reject_enable_with_invalid_hostname(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://exa\u2014mple.com/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=False,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert (
            "Cannot enable a webhook with a localhost or private IP URL"
            in response.text
        )
        await session.refresh(endpoint)
        assert endpoint.enabled is False

    async def test_disable_with_localhost_url_succeeds(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            url="https://127.0.0.1/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="foobar",
            enabled=True,
        )
        await save_fixture(endpoint)

        response = await backoffice_client.post(
            f"/webhooks/{endpoint.id}/toggle-enabled"
        )

        assert response.status_code == 200
        assert "Webhook disabled successfully" in response.text
        await session.refresh(endpoint)
        assert endpoint.enabled is False

import hashlib
import hmac
import json
import time
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.integrations.slack.repository import OrganizationSlackIntegrationRepository
from polar.kit import jwt
from polar.models import (
    Organization,
    OrganizationSlackIntegration,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def _create_integration(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    bot_token: str | None = "xoxb-test-token",
    slack_app_id: str = "A0TESTAPPID",
    signing_secret: str = "ss-test-secret",
) -> OrganizationSlackIntegration:
    integration = OrganizationSlackIntegration(
        organization_id=organization.id,
        display_name="Test",
        slack_app_id=slack_app_id,
        client_id="100.200",
        client_secret="cs-test-secret",
        signing_secret=signing_secret,
        team_id="T1" if bot_token else None,
        team_name="Test team" if bot_token else None,
        bot_user_id="U1" if bot_token else None,
        bot_token=bot_token,
        authed_user_id="U2" if bot_token else None,
        scopes=["channels:manage"] if bot_token else None,
    )
    await save_fixture(integration)
    return integration


def _slack_signature(
    *, signing_secret: str, body: bytes, timestamp: int | None = None
) -> tuple[str, str]:
    ts = timestamp if timestamp is not None else int(time.time())
    basestring = f"v0:{ts}:".encode() + body
    digest = hmac.new(signing_secret.encode(), basestring, hashlib.sha256).hexdigest()
    return str(ts), f"v0={digest}"


@pytest.mark.asyncio
class TestGetIntegration:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_read}),
    )
    async def test_not_member_returns_403(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await _create_integration(save_fixture, organization)
        response = await client.get(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_user_returns_integration(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        response = await client.get(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["team_id"] == "T1"
        assert "bot_token" not in json_body
        assert "client_secret" not in json_body

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_not_configured_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestListWorkspaceUsers:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/integrations/slack/users",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_not_configured_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/integrations/slack/users",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_returns_active_non_bot_users(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _create_integration(save_fixture, organization)
        mocker.patch(
            "polar.integrations.slack.service."
            "OrganizationSlackIntegrationService.list_workspace_users",
            new=AsyncMock(
                return_value=[
                    {
                        "id": "U01",
                        "name": "alice",
                        "real_name": "Alice Smith",
                        "image_url": "https://x/alice.jpg",
                        "is_admin": True,
                    },
                    {
                        "id": "U02",
                        "name": "bob",
                        "real_name": "Bob Jones",
                        "image_url": None,
                        "is_admin": False,
                    },
                ]
            ),
        )

        response = await client.get(
            "/v1/integrations/slack/users",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 200
        body = response.json()
        assert [u["id"] for u in body["users"]] == ["U01", "U02"]
        assert body["users"][0]["is_admin"] is True


@pytest.mark.asyncio
class TestDeleteIntegration:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.delete(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_not_member_returns_403(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await _create_integration(save_fixture, organization)
        response = await client.delete(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_deletes_row(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        response = await client.delete(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 204

        repo = OrganizationSlackIntegrationRepository.from_session(session)
        assert await repo.get_by_organization(organization.id) is None

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_missing_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(
            "/v1/integrations/slack/integration",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestPostCredentials:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/integrations/slack/credentials",
            json={
                "organization_id": str(organization.id),
                "display_name": "Test",
                "slack_app_id": "A0NEWAPPID0",
                "client_id": "100.200",
                "client_secret": "cs-test-secret",
                "signing_secret": "ss-test-secret",
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_not_member_is_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.integrations.slack.service."
            "OrganizationSlackIntegrationService._validate_credentials",
            new=AsyncMock(),
        )
        response = await client.post(
            "/v1/integrations/slack/credentials",
            json={
                "organization_id": str(organization.id),
                "display_name": "Test",
                "slack_app_id": "A0NEWAPPID0",
                "client_id": "100.200",
                "client_secret": "cs-test-secret",
                "signing_secret": "ss-test-secret",
            },
        )
        # 422 because the user has no membership → org payload resolution rejects.
        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_saves_credentials(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.integrations.slack.service."
            "OrganizationSlackIntegrationService._validate_credentials",
            new=AsyncMock(),
        )
        response = await client.post(
            "/v1/integrations/slack/credentials",
            json={
                "organization_id": str(organization.id),
                "display_name": "Test",
                "slack_app_id": "A0NEWAPPID0",
                "client_id": "100.200",
                "client_secret": "cs-test-secret",
                "signing_secret": "ss-test-secret",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["slack_app_id"] == "A0NEWAPPID0"
        assert body["client_secret_last_4"] == "cret"


@pytest.mark.asyncio
class TestCallback:
    async def test_invalid_state(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.get(
            "/v1/integrations/slack/callback",
            params={"code": "x", "state": "garbage"},
        )
        # Unauthenticated → 401 before the state is even decoded.
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organizations_write}),
    )
    async def test_subject_mismatch_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        await _create_integration(save_fixture, organization, bot_token=None)
        from polar.config import settings

        state = jwt.encode(
            data={
                "organization_id": str(organization.id),
                "subject_id": "00000000-0000-0000-0000-000000000000",
                "return_to": "/",
            },
            secret=settings.SECRET,
            type="slack_integration_oauth",
        )

        response = await client.get(
            "/v1/integrations/slack/callback",
            params={"code": "x", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 400


@pytest.mark.asyncio
class TestEvents:
    async def test_missing_signature_returns_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/integrations/slack/events", json={"api_app_id": "A0X"}
        )
        assert response.status_code == 401

    async def test_unknown_app_returns_401(self, client: AsyncClient) -> None:
        body = json.dumps({"api_app_id": "A0DOESNOTEXIST"}).encode()
        ts, sig = _slack_signature(signing_secret="x", body=body)
        response = await client.post(
            "/v1/integrations/slack/events",
            content=body,
            headers={
                "x-slack-signature": sig,
                "x-slack-request-timestamp": ts,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 401

    async def test_bad_signature_returns_401(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        body = json.dumps({"api_app_id": "A0TESTAPPID"}).encode()
        ts = str(int(time.time()))
        response = await client.post(
            "/v1/integrations/slack/events",
            content=body,
            headers={
                "x-slack-signature": "v0=deadbeef",
                "x-slack-request-timestamp": ts,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 401

    async def test_stale_timestamp_returns_401(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        body = json.dumps({"api_app_id": "A0TESTAPPID"}).encode()
        stale = int(time.time()) - 10 * 60
        ts, sig = _slack_signature(
            signing_secret="ss-test-secret", body=body, timestamp=stale
        )
        response = await client.post(
            "/v1/integrations/slack/events",
            content=body,
            headers={
                "x-slack-signature": sig,
                "x-slack-request-timestamp": ts,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 401

    async def test_url_verification_returns_challenge(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        payload = {
            "type": "url_verification",
            "api_app_id": "A0TESTAPPID",
            "challenge": "abc123",
        }
        body = json.dumps(payload).encode()
        ts, sig = _slack_signature(signing_secret="ss-test-secret", body=body)
        response = await client.post(
            "/v1/integrations/slack/events",
            content=body,
            headers={
                "x-slack-signature": sig,
                "x-slack-request-timestamp": ts,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 200
        assert response.json() == {"challenge": "abc123"}

    async def test_event_callback_runs_handler(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await _create_integration(save_fixture, organization)
        payload = {
            "type": "event_callback",
            "api_app_id": "A0TESTAPPID",
            "event": {"type": "tokens_revoked"},
        }
        body = json.dumps(payload).encode()
        ts, sig = _slack_signature(signing_secret="ss-test-secret", body=body)
        response = await client.post(
            "/v1/integrations/slack/events",
            content=body,
            headers={
                "x-slack-signature": sig,
                "x-slack-request-timestamp": ts,
                "content-type": "application/json",
            },
        )
        assert response.status_code == 200

        repo = OrganizationSlackIntegrationRepository.from_session(session)
        integration = await repo.get_by_organization(organization.id)
        assert integration is not None
        assert integration.bot_token is None
        assert integration.revoked_at is not None

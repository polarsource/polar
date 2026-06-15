from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.config import settings
from polar.integrations.slack.repository import SlackAppRepository
from polar.integrations.slack.schemas import SlackIntegrationCredentialsUpdate
from polar.integrations.slack.service import (
    OAUTH_STATE_JWT_TYPE,
    SlackAppService,
    SlackIntegrationAppIdAlreadyLinked,
    SlackIntegrationInvalidCredentials,
    SlackIntegrationInvalidState,
    SlackIntegrationNotConfigured,
)
from polar.kit import jwt
from polar.models import (
    Benefit,
    Customer,
    Organization,
    SlackApp,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant

_REDIRECT_URI = "https://api.polar.sh/v1/integrations/slack/callback"
_BASE_PROPERTIES = {
    "channel_name_template": "support-{customer_name}",
    "private": True,
    "welcome_message": None,
    "archive_on_revoke": True,
    "team_invitees": [],
}


async def _create_benefit(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.slack_shared_channel,
        properties=_BASE_PROPERTIES,
    )


async def _create_integration(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    benefit: Benefit | None = None,
    bot_token: str | None = "xoxb-test-token",
    slack_app_id: str = "A0TESTAPPID",
) -> SlackApp:
    integration = SlackApp(
        organization_id=organization.id,
        display_name="Test",
        slack_app_id=slack_app_id,
        client_id="100.200",
        client_secret="cs-test",
        signing_secret="ss-test",
        team_id="T1" if bot_token else None,
        team_name="Test team" if bot_token else None,
        bot_user_id="U1" if bot_token else None,
        bot_token=bot_token,
        authed_user_id="U2" if bot_token else None,
        scopes=["channels:manage"] if bot_token else None,
    )
    await save_fixture(integration)
    if benefit is not None:
        benefit.properties = {
            **benefit.properties,
            "slack_integration_id": str(integration.id),
        }
        await save_fixture(benefit)
    return integration


def _service_with_mock(
    mocker: MockerFixture, **overrides: object
) -> tuple[SlackAppService, AsyncMock]:
    client = AsyncMock()
    client.oauth_v2_access = AsyncMock(
        return_value=overrides.get(
            "oauth_v2_access",
            {
                "ok": True,
                "app_id": "A0TESTAPPID",
                "team": {"id": "T1", "name": "Test team"},
                "bot_user_id": "U1",
                "access_token": "xoxb-new-token",
                "authed_user": {"id": "U2"},
                "scope": "channels:manage,chat:write",
            },
        )
    )
    service = SlackAppService()
    service._client = client
    return service, client


@pytest.mark.asyncio
class TestSetCredentials:
    async def test_creates_when_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        service, _client = _service_with_mock(
            mocker,
            oauth_v2_access={"ok": False, "error": "invalid_code"},
        )
        update = SlackIntegrationCredentialsUpdate(
            organization_id=organization.id,
            display_name="Test",
            slack_app_id="A0NEWAPPID0",
            client_id="100.200",
            client_secret="cs-test-secret",
            signing_secret="ss-test-secret",
        )

        integration = await service.set_credentials(
            session, organization.id, update, redirect_uri=_REDIRECT_URI
        )

        assert integration.slack_app_id == "A0NEWAPPID0"
        assert integration.bot_token is None
        assert integration.team_id is None

    async def test_rotating_secrets_preserves_oauth_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(
            mocker,
            oauth_v2_access={"ok": False, "error": "invalid_code"},
        )
        update = SlackIntegrationCredentialsUpdate(
            organization_id=organization.id,
            display_name="Test",
            slack_app_id="A0TESTAPPID",
            client_id="100.200",
            client_secret="cs-new-secret",
            signing_secret="ss-new-secret",
        )

        integration = await service.set_credentials(
            session, organization.id, update, redirect_uri=_REDIRECT_URI
        )

        # Same client_id and slack_app_id, only secrets rotated: keep install.
        assert integration.bot_token == "xoxb-test-token"
        assert integration.team_id == "T1"
        assert integration.client_secret == "cs-new-secret"
        assert integration.signing_secret == "ss-new-secret"

    async def test_changing_client_id_resets_oauth_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(
            mocker,
            oauth_v2_access={"ok": False, "error": "invalid_code"},
        )
        update = SlackIntegrationCredentialsUpdate(
            organization_id=organization.id,
            display_name="Test",
            slack_app_id="A0TESTAPPID",
            client_id="999.888",
            client_secret="cs-new-secret",
            signing_secret="ss-new-secret",
        )

        integration = await service.set_credentials(
            session, organization.id, update, redirect_uri=_REDIRECT_URI
        )

        assert integration.bot_token is None
        assert integration.team_id is None
        assert integration.client_id == "999.888"

    async def test_rejects_app_id_owned_by_another_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await _create_integration(
            save_fixture, organization_second, slack_app_id="A0CONFLICTX"
        )
        await session.flush()
        service, _client = _service_with_mock(
            mocker,
            oauth_v2_access={"ok": False, "error": "invalid_code"},
        )
        update = SlackIntegrationCredentialsUpdate(
            organization_id=organization.id,
            display_name="Test",
            slack_app_id="A0CONFLICTX",
            client_id="100.200",
            client_secret="cs-test-secret",
            signing_secret="ss-test-secret",
        )

        with pytest.raises(SlackIntegrationAppIdAlreadyLinked):
            await service.set_credentials(
                session, organization.id, update, redirect_uri=_REDIRECT_URI
            )

    async def test_raises_when_slack_rejects_credentials(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        service, _client = _service_with_mock(
            mocker,
            oauth_v2_access={"ok": False, "error": "invalid_client_id"},
        )
        update = SlackIntegrationCredentialsUpdate(
            organization_id=organization.id,
            display_name="Test",
            slack_app_id="A0BADAPPXXX",
            client_id="1.234",
            client_secret="bad-secret-x",
            signing_secret="bad-secret-x",
        )

        with pytest.raises(SlackIntegrationInvalidCredentials):
            await service.set_credentials(
                session, organization.id, update, redirect_uri=_REDIRECT_URI
            )


class TestDecodeState:
    def test_rejects_unexpected_token_type(self) -> None:
        state = jwt.encode(
            data={},
            secret=settings.SECRET,
            type="discord_oauth",
        )

        with pytest.raises(SlackIntegrationInvalidState):
            SlackAppService().decode_state(state)

    def test_decodes_expected_token_type(self) -> None:
        integration_id = uuid4()
        subject_id = uuid4()
        state = jwt.encode(
            data={
                "integration_id": str(integration_id),
                "subject_id": str(subject_id),
                "return_to": "https://polar.sh/dashboard",
            },
            secret=settings.SECRET,
            type=OAUTH_STATE_JWT_TYPE,
        )

        decoded = SlackAppService().decode_state(state)

        assert decoded["integration_id"] == str(integration_id)
        assert decoded["subject_id"] == str(subject_id)
        assert decoded["return_to"] == "https://polar.sh/dashboard"


@pytest.mark.asyncio
class TestCompleteInstall:
    async def test_persists_bot_token_and_scopes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        created = await _create_integration(save_fixture, organization, bot_token=None)
        service, _client = _service_with_mock(mocker)

        integration = await service.complete_install(
            session, created.id, code="abc", redirect_uri=_REDIRECT_URI
        )

        assert integration.bot_token == "xoxb-new-token"
        assert integration.team_id == "T1"
        assert integration.team_name == "Test team"
        assert integration.scopes == ["channels:manage", "chat:write"]
        assert integration.installed_at is not None
        assert integration.revoked_at is None

    async def test_rejects_app_id_mismatch(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        created = await _create_integration(save_fixture, organization, bot_token=None)
        service, client = _service_with_mock(mocker)
        client.oauth_v2_access = AsyncMock(
            return_value={
                "ok": True,
                "app_id": "A0OTHERAPP",
                "team": {"id": "T1"},
                "access_token": "xoxb-x",
                "scope": "channels:manage",
            }
        )

        with pytest.raises(SlackIntegrationInvalidCredentials, match="app_id_mismatch"):
            await service.complete_install(
                session, created.id, code="abc", redirect_uri=_REDIRECT_URI
            )

    async def test_raises_when_no_integration(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        service, _client = _service_with_mock(mocker)
        with pytest.raises(SlackIntegrationNotConfigured):
            await service.complete_install(
                session, uuid4(), code="abc", redirect_uri=_REDIRECT_URI
            )

    async def test_empty_scope_string_yields_none(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        created = await _create_integration(save_fixture, organization, bot_token=None)
        service, client = _service_with_mock(mocker)
        client.oauth_v2_access = AsyncMock(
            return_value={
                "ok": True,
                "app_id": "A0TESTAPPID",
                "team": {"id": "T1"},
                "access_token": "xoxb-x",
                "scope": "",
            }
        )

        integration = await service.complete_install(
            session, created.id, code="abc", redirect_uri=_REDIRECT_URI
        )
        assert integration.scopes is None


@pytest.mark.asyncio
class TestHandleEvent:
    async def test_tokens_revoked_clears_bot_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(mocker)

        await service.handle_event(
            session,
            api_app_id="A0TESTAPPID",
            event={"type": "tokens_revoked"},
        )

        repo = SlackAppRepository.from_session(session)
        integration = await repo.get_by_app_id("A0TESTAPPID")
        assert integration is not None
        assert integration.bot_token is None
        assert integration.revoked_at is not None

    async def test_app_uninstalled_clears_bot_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(mocker)

        await service.handle_event(
            session,
            api_app_id="A0TESTAPPID",
            event={"type": "app_uninstalled"},
        )

        repo = SlackAppRepository.from_session(session)
        integration = await repo.get_by_app_id("A0TESTAPPID")
        assert integration is not None
        assert integration.bot_token is None

    async def test_unknown_app_is_noop(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        service, _client = _service_with_mock(mocker)
        await service.handle_event(
            session,
            api_app_id="A0DOESNOTEXIST",
            event={"type": "tokens_revoked"},
        )

    async def test_channel_shared_records_connected_team(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await _create_benefit(save_fixture, organization)
        await _create_integration(save_fixture, organization, benefit=benefit)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            properties={
                "invited_email": "a@example.com",
                "channel_id": "C123",
            },
        )
        await session.flush()
        service, _client = _service_with_mock(mocker)

        await service.handle_event(
            session,
            api_app_id="A0TESTAPPID",
            event={
                "type": "channel_shared",
                "channel": "C123",
                "connected_team_id": "TCUST",
            },
        )

        repo = BenefitGrantRepository.from_session(session)
        refreshed = await repo.get_by_id(grant.id)
        assert refreshed is not None
        assert (refreshed.properties or {}).get("connected_team_id") == "TCUST"

    async def test_channel_shared_ignores_same_channel_id_for_other_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await _create_benefit(save_fixture, organization)
        other_benefit = await _create_benefit(save_fixture, organization)
        await _create_integration(save_fixture, organization, benefit=benefit)
        other_grant = await create_benefit_grant(
            save_fixture,
            customer,
            other_benefit,
            properties={
                "invited_email": "a@example.com",
                "channel_id": "C123",
            },
        )
        await session.flush()
        service, _client = _service_with_mock(mocker)

        await service.handle_event(
            session,
            api_app_id="A0TESTAPPID",
            event={
                "type": "channel_shared",
                "channel": "C123",
                "connected_team_id": "TCUST",
            },
        )

        repo = BenefitGrantRepository.from_session(session)
        refreshed = await repo.get_by_id(other_grant.id)
        assert refreshed is not None
        assert "connected_team_id" not in (refreshed.properties or {})


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_removes_row(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        created = await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(mocker)

        integration = await service.get(session, created.id)
        assert integration is not None
        await service.delete(session, integration)

        assert await service.get(session, created.id) is None

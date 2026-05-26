from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.slack.repository import OrganizationSlackIntegrationRepository
from polar.integrations.slack.schemas import SlackIntegrationCredentialsUpdate
from polar.integrations.slack.service import (
    OrganizationSlackIntegrationService,
    SlackIntegrationAppIdAlreadyLinked,
    SlackIntegrationInvalidCredentials,
    SlackIntegrationNotConfigured,
)
from polar.models import (
    Customer,
    Organization,
    OrganizationSlackIntegration,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant

_REDIRECT_URI = "https://api.polar.sh/v1/integrations/slack/callback"


async def _create_integration(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    bot_token: str | None = "xoxb-test-token",
    slack_app_id: str = "A0TESTAPPID",
) -> OrganizationSlackIntegration:
    integration = OrganizationSlackIntegration(
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
    return integration


def _service_with_mock(
    mocker: MockerFixture, **overrides: object
) -> tuple[OrganizationSlackIntegrationService, AsyncMock]:
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
    service = OrganizationSlackIntegrationService()
    service._client = client
    return service, client


@pytest.mark.asyncio
class TestSetCredentials:
    async def test_creates_when_missing(
        self,
        session: AsyncSession,
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
            session, organization, update, redirect_uri=_REDIRECT_URI
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
            session, organization, update, redirect_uri=_REDIRECT_URI
        )

        # Same client_id and slack_app_id, only secrets rotated → keep install
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
            session, organization, update, redirect_uri=_REDIRECT_URI
        )

        assert integration.bot_token is None
        assert integration.team_id is None
        assert integration.client_id == "999.888"

    async def test_rejects_app_id_owned_by_another_org(
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
                session, organization, update, redirect_uri=_REDIRECT_URI
            )

    async def test_raises_when_slack_rejects_credentials(
        self,
        session: AsyncSession,
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
                session, organization, update, redirect_uri=_REDIRECT_URI
            )


@pytest.mark.asyncio
class TestCompleteInstall:
    async def test_persists_bot_token_and_scopes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization, bot_token=None)
        service, _client = _service_with_mock(mocker)

        integration = await service.complete_install(
            session, organization.id, code="abc", redirect_uri=_REDIRECT_URI
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
        await _create_integration(save_fixture, organization, bot_token=None)
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
                session, organization.id, code="abc", redirect_uri=_REDIRECT_URI
            )

    async def test_raises_when_no_integration(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        service, _client = _service_with_mock(mocker)
        with pytest.raises(SlackIntegrationNotConfigured):
            await service.complete_install(
                session, organization.id, code="abc", redirect_uri=_REDIRECT_URI
            )

    async def test_empty_scope_string_yields_none(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization, bot_token=None)
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
            session, organization.id, code="abc", redirect_uri=_REDIRECT_URI
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

        repo = OrganizationSlackIntegrationRepository.from_session(session)
        integration = await repo.get_by_organization(organization.id)
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

        repo = OrganizationSlackIntegrationRepository.from_session(session)
        integration = await repo.get_by_organization(organization.id)
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
        from polar.benefit.grant.repository import BenefitGrantRepository

        await _create_integration(save_fixture, organization)
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={
                "channel_name_template": "x-{customer_name}",
                "private": True,
                "welcome_message": None,
                "archive_on_revoke": True,
            },
        )
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


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_removes_row(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        await _create_integration(save_fixture, organization)
        service, _client = _service_with_mock(mocker)

        integration = await service.get(session, organization.id)
        assert integration is not None
        await service.delete(session, integration)

        assert await service.get(session, organization.id) is None

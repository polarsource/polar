from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from pytest_mock import MockerFixture

from polar.benefit.strategies import (
    BenefitActionRequiredError,
    BenefitRetriableError,
)
from polar.benefit.strategies.slack_shared_channel.properties import (
    BenefitGrantSlackSharedChannelProperties,
    BenefitSlackSharedChannelProperties,
)
from polar.benefit.strategies.slack_shared_channel.service import (
    BenefitSlackSharedChannelService,
)
from polar.models import (
    Benefit,
    Customer,
    Organization,
    SlackApp,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit

_BASE_PROPERTIES = {
    "channel_name_template": "support-{customer_name}",
    "private": True,
    "welcome_message": None,
    "archive_on_revoke": True,
    "team_invitees": [],
}


async def _create_integration(
    save_fixture: SaveFixture,
    benefit: Benefit,
    *,
    bot_token: str | None = "xoxb-test-token",
) -> SlackApp:
    integration = SlackApp(
        organization_id=benefit.organization_id,
        display_name="Test",
        slack_app_id="A0TESTAPPID",
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
    benefit.properties = {
        **benefit.properties,
        "slack_integration_id": str(integration.id),
    }
    await save_fixture(benefit)
    return integration


def _mock_client(mocker: MockerFixture, **overrides: Any) -> AsyncMock:
    defaults: dict[str, Any] = {
        "conversations_create": AsyncMock(
            return_value={
                "ok": True,
                "channel": {"id": "C123", "name": "support-acme"},
            }
        ),
        "conversations_list": AsyncMock(
            return_value={
                "ok": True,
                "channels": [],
                "response_metadata": {"next_cursor": ""},
            }
        ),
        "conversations_join": AsyncMock(
            return_value={
                "ok": True,
                "channel": {"id": "CEXIST", "name": "support-acme"},
            }
        ),
        "chat_post_message": AsyncMock(return_value={"ok": True}),
        "conversations_invite": AsyncMock(return_value={"ok": True}),
        "conversations_invite_shared": AsyncMock(
            return_value={
                "ok": True,
                "invite_id": "I123",
                "url": "https://slack.com/share/I123",
            }
        ),
        "conversations_archive": AsyncMock(return_value={"ok": True}),
    }
    defaults.update(overrides)
    client = AsyncMock()
    for name, mock in defaults.items():
        setattr(client, name, mock)
    return client


def _strategy(
    session: AsyncSession, redis: Redis, client: AsyncMock
) -> BenefitSlackSharedChannelService:
    strategy = BenefitSlackSharedChannelService(session, redis)
    strategy._client = client
    return strategy


@pytest.mark.asyncio
class TestSlackSharedChannelGrant:
    async def test_grant_happy_path(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "C123"
        assert result["channel_name"] == "support-acme"
        assert result["invite_id"] == "I123"
        assert result["invite_url"].startswith("https://slack.com/share/")

        client.conversations_create.assert_awaited_once()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="C123",
            email="admin@customer.example",
        )

    async def test_grant_handles_external_limited_invite_without_url(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_invite_shared=AsyncMock(
                return_value={
                    "ok": True,
                    "invite_id": "I123",
                    "is_legacy_shared_channel": False,
                }
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["invite_id"] == "I123"
        assert "invite_url" not in result

    async def test_grant_reuses_existing_public_channel_by_rendered_name(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_list=AsyncMock(
                return_value={
                    "ok": True,
                    "channels": [
                        {
                            "id": "CEXIST",
                            "name": "support-acme",
                            "is_private": False,
                            "is_member": True,
                        }
                    ],
                }
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "CEXIST"
        assert result["channel_name"] == "support-acme"
        client.conversations_create.assert_not_awaited()
        client.conversations_join.assert_not_awaited()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="CEXIST",
            email="admin@customer.example",
        )

    async def test_grant_joins_and_reuses_existing_public_channel_by_rendered_name(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_list=AsyncMock(
                return_value={
                    "ok": True,
                    "channels": [
                        {
                            "id": "CEXIST",
                            "name": "support-acme",
                            "is_private": False,
                            "is_member": False,
                        }
                    ],
                }
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "CEXIST"
        client.conversations_join.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="CEXIST"
        )
        client.conversations_create.assert_not_awaited()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="CEXIST",
            email="admin@customer.example",
        )

    async def test_grant_reuses_existing_private_channel_when_app_is_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "private": True},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_list=AsyncMock(
                return_value={
                    "ok": True,
                    "channels": [
                        {
                            "id": "GEXIST",
                            "name": "support-acme",
                            "is_private": True,
                            "is_member": True,
                        }
                    ],
                }
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "GEXIST"
        client.conversations_create.assert_not_awaited()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="GEXIST",
            email="admin@customer.example",
        )

    async def test_grant_creates_channel_when_existing_public_channel_cannot_be_joined(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        customer.name = "Acme"
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_list=AsyncMock(
                return_value={
                    "ok": True,
                    "channels": [
                        {
                            "id": "CEXIST",
                            "name": "support-acme",
                            "is_private": False,
                            "is_member": False,
                        }
                    ],
                }
            ),
            conversations_join=AsyncMock(
                return_value={"ok": False, "error": "missing_scope"}
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "C123"
        client.conversations_join.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="CEXIST"
        )
        client.conversations_create.assert_awaited_once()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="C123",
            email="admin@customer.example",
        )

    async def test_grant_missing_email_raises_action_required(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitActionRequiredError):
            await strategy.grant(benefit, customer, {})

        client.conversations_create.assert_not_awaited()

    async def test_grant_lock_contention_is_retriable(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)
        redis_set = mocker.patch.object(redis, "set", AsyncMock(return_value=False))

        with pytest.raises(BenefitRetriableError) as exc_info:
            await strategy.grant(
                benefit,
                customer,
                {"invited_email": "admin@customer.example"},
                attempt=0,
            )

        assert exc_info.value.defer_seconds == 60
        redis_set.assert_awaited_once_with(
            f"slack_benefit_grant:{benefit.id}:{customer.id}",
            "1",
            ex=60,
            nx=True,
        )
        client.conversations_create.assert_not_awaited()
        client.conversations_invite_shared.assert_not_awaited()

    async def test_grant_on_update_invites_team_to_existing_channel(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "team_invitees": ["U01", "U02"]},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        existing: BenefitGrantSlackSharedChannelProperties = {
            "invited_email": "admin@customer.example",
            "channel_id": "CEXIST",
            "channel_name": "support-existing",
            "invite_id": "I123",
        }
        result = await strategy.grant(benefit, customer, existing, update=True)

        assert result == existing
        client.conversations_invite.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="CEXIST", users=["U01", "U02"]
        )
        client.conversations_create.assert_not_awaited()

    async def test_requires_update_when_team_invitees_change(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "team_invitees": ["U01", "U02"]},
        )
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        previous_changed: BenefitSlackSharedChannelProperties = {
            **_BASE_PROPERTIES,  # type: ignore[typeddict-item]
            "team_invitees": ["U01"],
        }
        previous_same: BenefitSlackSharedChannelProperties = {
            **_BASE_PROPERTIES,  # type: ignore[typeddict-item]
            "team_invitees": ["U02", "U01"],
        }
        assert await strategy.requires_update(benefit, previous_changed) is True
        assert await strategy.requires_update(benefit, previous_same) is False

    async def test_grant_skips_when_channel_already_provisioned_on_update(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        existing: BenefitGrantSlackSharedChannelProperties = {
            "invited_email": "admin@customer.example",
            "channel_id": "CEXIST",
            "channel_name": "support-existing",
            "invite_id": "I123",
        }
        result = await strategy.grant(benefit, customer, existing, update=True)

        assert result == existing
        client.conversations_create.assert_not_awaited()
        client.conversations_invite_shared.assert_not_awaited()

    async def test_grant_retries_shared_invite_for_existing_channel(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        existing: BenefitGrantSlackSharedChannelProperties = {
            "invited_email": "admin@customer.example",
            "channel_id": "CEXIST",
            "channel_name": "support-existing",
        }
        result = await strategy.grant(benefit, customer, existing, update=True)

        assert result["channel_id"] == "CEXIST"
        assert result["channel_name"] == "support-existing"
        assert result["invite_id"] == "I123"
        client.conversations_create.assert_not_awaited()
        client.conversations_invite_shared.assert_awaited_once_with(
            bot_token="xoxb-test-token",
            channel="CEXIST",
            email="admin@customer.example",
        )

    async def test_grant_retries_on_name_taken(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_create=AsyncMock(
                side_effect=[
                    {"ok": False, "error": "name_taken"},
                    {
                        "ok": True,
                        "channel": {"id": "C456", "name": "support-acme-1234"},
                    },
                ]
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "C456"
        assert client.conversations_create.await_count == 2

    async def test_grant_name_taken_twice_raises(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_create=AsyncMock(
                return_value={"ok": False, "error": "name_taken"}
            ),
        )
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitActionRequiredError, match="name_taken"):
            await strategy.grant(
                benefit,
                customer,
                {"invited_email": "admin@customer.example"},
            )

    async def test_grant_without_integration_raises_action_required(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitActionRequiredError, match="not installed"):
            await strategy.grant(
                benefit,
                customer,
                {"invited_email": "admin@customer.example"},
            )

    async def test_grant_with_uninstalled_integration_raises(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit, bot_token=None)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitActionRequiredError, match="not installed"):
            await strategy.grant(
                benefit,
                customer,
                {"invited_email": "admin@customer.example"},
            )

    async def test_grant_invites_team_members(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "team_invitees": ["U01", "U02"]},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        client.conversations_invite.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="C123", users=["U01", "U02"]
        )

    async def test_grant_skips_invite_when_team_invitees_empty(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        client.conversations_invite.assert_not_awaited()

    async def test_grant_continues_when_team_invite_fails(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "team_invitees": ["U01"]},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_invite=AsyncMock(
                return_value={"ok": False, "error": "not_in_channel"}
            ),
        )
        strategy = _strategy(session, redis, client)

        result = await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        assert result["channel_id"] == "C123"
        client.conversations_invite_shared.assert_awaited_once()

    async def test_grant_posts_welcome_message(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "welcome_message": "Welcome!"},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.grant(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        client.chat_post_message.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="C123", text="Welcome!"
        )

    async def test_grant_invite_http_error_is_retriable(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_invite_shared=AsyncMock(
                side_effect=httpx.ConnectError("boom")
            ),
        )
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitRetriableError):
            await strategy.grant(
                benefit,
                customer,
                {"invited_email": "admin@customer.example"},
            )


@pytest.mark.asyncio
class TestSlackSharedChannelRevoke:
    async def test_revoke_archives_when_enabled(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        result = await strategy.revoke(
            benefit,
            customer,
            {"invited_email": "admin@customer.example", "channel_id": "C123"},
        )

        client.conversations_archive.assert_awaited_once_with(
            bot_token="xoxb-test-token", channel="C123"
        )
        assert result == {"invited_email": "admin@customer.example"}

    async def test_revoke_skips_when_archive_disabled(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties={**_BASE_PROPERTIES, "archive_on_revoke": False},
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.revoke(
            benefit,
            customer,
            {"invited_email": "admin@customer.example", "channel_id": "C123"},
        )

        client.conversations_archive.assert_not_awaited()

    async def test_revoke_skips_when_no_channel_id(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.revoke(
            benefit,
            customer,
            {"invited_email": "admin@customer.example"},
        )

        client.conversations_archive.assert_not_awaited()

    async def test_revoke_skips_when_integration_uninstalled(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit, bot_token=None)
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)

        await strategy.revoke(
            benefit,
            customer,
            {"invited_email": "admin@customer.example", "channel_id": "C123"},
        )

        client.conversations_archive.assert_not_awaited()

    async def test_revoke_archive_http_error_raises_retriable(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.slack_shared_channel,
            properties=_BASE_PROPERTIES,
        )
        await _create_integration(save_fixture, benefit)
        client = _mock_client(
            mocker,
            conversations_archive=AsyncMock(side_effect=httpx.ConnectError("boom")),
        )
        strategy = _strategy(session, redis, client)

        with pytest.raises(BenefitRetriableError):
            await strategy.revoke(
                benefit,
                customer,
                {"invited_email": "admin@customer.example", "channel_id": "C123"},
            )


@pytest.mark.asyncio
class TestSlackSharedChannelValidate:
    async def test_validate_rejects_unknown_placeholder(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
    ) -> None:
        from polar.benefit.strategies import BenefitPropertiesValidationError

        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)
        with pytest.raises(BenefitPropertiesValidationError):
            await strategy.validate_properties(
                None,  # type: ignore[arg-type]
                {
                    "channel_name_template": "{organization_slug}-foo",
                    "private": True,
                    "welcome_message": None,
                    "archive_on_revoke": True,
                },
            )

    async def test_validate_accepts_valid_template(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
    ) -> None:
        client = _mock_client(mocker)
        strategy = _strategy(session, redis, client)
        result = await strategy.validate_properties(
            None,  # type: ignore[arg-type]
            {
                "channel_name_template": "support-{customer_name}",
                "private": True,
                "welcome_message": None,
                "archive_on_revoke": True,
            },
        )
        assert result["channel_name_template"] == "support-{customer_name}"

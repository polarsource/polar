import asyncio
import contextlib
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.integrations.slack.client import SlackClientError
from polar.merchant_migration.pan_transfer import PanTransferMethod
from polar.merchant_migration.slack import SlackAlertInProgress
from polar.merchant_migration.tasks import (
    merchant_migration_notify_created,
    merchant_migration_notify_waiting_for_ops,
)
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture

from ._helpers import build_connected_migration, pan_steps_until


@pytest.fixture
def chat_post_message(mocker: MockerFixture, session: AsyncSession) -> AsyncMock:
    mocker.patch(
        "polar.merchant_migration.tasks.AsyncSessionMaker",
        side_effect=lambda: contextlib.nullcontext(session),
    )
    mocker.patch(
        "polar.merchant_migration.slack.ALERT_ENVIRONMENTS", frozenset({settings.ENV})
    )
    mocker.patch.object(settings, "SLACK_BOT_TOKEN", "xoxb-test")
    return mocker.patch(
        "polar.merchant_migration.slack.slack_client.chat_post_message",
        new_callable=AsyncMock,
    )


@pytest.mark.asyncio
class TestNotifyCreated:
    @pytest.mark.parametrize(
        "failure", [SlackClientError("down"), asyncio.CancelledError()]
    )
    async def test_posts_once_and_retries_after_a_failure(
        self,
        failure: BaseException,
        chat_post_message: AsyncMock,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.name = "Acme & Co <!channel>"
        await save_fixture(organization)
        migration = await build_connected_migration(save_fixture, organization)
        chat_post_message.side_effect = [failure, {"ok": True}]

        with pytest.raises(type(failure)):
            await merchant_migration_notify_created(migration.id)
        await merchant_migration_notify_created(migration.id)
        await merchant_migration_notify_created(migration.id)

        assert chat_post_message.await_count == 2
        kwargs = chat_post_message.await_args_list[-1].kwargs
        assert kwargs["channel"] == "C0B76J9KR8F"
        assert kwargs["text"] == f":truck: New merchant migration: {organization.slug}"
        assert kwargs["blocks"][1]["fields"][0] == {
            "type": "mrkdwn",
            "text": f"*Organization*\nAcme &amp; Co &lt;!channel&gt; ({organization.slug})",
        }
        body = str(kwargs["blocks"])
        assert str(migration.id) in body
        assert f"/merchant-migrations/{migration.id}" in body
        assert "rk_test_123" not in body

    async def test_retries_while_another_post_is_in_flight(
        self,
        chat_post_message: AsyncMock,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        in_progress_key = f"merchant_migration:slack:created:{migration.id}:in_progress"
        await redis.set(in_progress_key, "1")

        with pytest.raises(SlackAlertInProgress):
            await merchant_migration_notify_created(migration.id)
        chat_post_message.assert_not_awaited()

        await redis.delete(in_progress_key)
        await merchant_migration_notify_created(migration.id)

        chat_post_message.assert_awaited_once()

    async def test_skips_outside_the_alert_environments(
        self,
        mocker: MockerFixture,
        chat_post_message: AsyncMock,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.development)
        migration = await build_connected_migration(save_fixture, organization)

        await merchant_migration_notify_created(migration.id)

        chat_post_message.assert_not_awaited()


@pytest.mark.asyncio
class TestNotifyWaitingForOps:
    async def test_posts_for_the_current_ops_step(
        self,
        chat_post_message: AsyncMock,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            PanTransferMethod.pan_copy, "authorize_copy"
        )
        await save_fixture(migration)

        await merchant_migration_notify_waiting_for_ops(migration.id, "authorize_copy")
        await merchant_migration_notify_waiting_for_ops(migration.id, "authorize_copy")

        chat_post_message.assert_awaited_once()
        assert "`authorize_copy`" in str(
            chat_post_message.await_args_list[-1].kwargs["blocks"]
        )

    async def test_skips_a_step_that_moved_on(
        self,
        chat_post_message: AsyncMock,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            PanTransferMethod.pan_copy, "stripe_copy"
        )
        await save_fixture(migration)

        await merchant_migration_notify_waiting_for_ops(migration.id, "authorize_copy")

        chat_post_message.assert_not_awaited()

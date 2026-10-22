import asyncio
import contextlib
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.integrations.slack.client import SlackClientError
from polar.kit.utils import utc_now
from polar.merchant_migration.pan_transfer import PanTransferMethod
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.merchant_migration.service import (
    merchant_migration as merchant_migration_service,
)
from polar.merchant_migration.slack import SlackAlertInProgress
from polar.merchant_migration.tasks import (
    merchant_migration_close_idle,
    merchant_migration_notify_created,
    merchant_migration_notify_waiting_for_ops,
)
from polar.models import (
    MerchantMigration,
    MerchantMigrationOperation,
    MerchantMigrationOperationStatus,
    MerchantMigrationRecord,
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
    Organization,
)
from polar.models.merchant_migration_operation import STALL_THRESHOLD
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture

from ._helpers import build_connected_migration, pan_steps_until, record_source_ids


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


@pytest.mark.anyio
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


@pytest.mark.anyio
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


IDLE = settings.MERCHANT_MIGRATION_IDLE_RETENTION_PERIOD + timedelta(days=1)


@pytest.fixture
def worker_session(mocker: MockerFixture, session: AsyncSession) -> AsyncSession:
    mocker.patch(
        "polar.merchant_migration.tasks.AsyncSessionMaker",
        side_effect=lambda: contextlib.nullcontext(session),
    )
    mocker.patch("polar.merchant_migration.tasks.asyncio.sleep", new=AsyncMock())
    return session


@pytest.fixture
async def idle_migration(
    save_fixture: SaveFixture, organization: Organization
) -> MerchantMigration:
    migration = await build_connected_migration(save_fixture, organization)
    migration.step = MerchantMigrationStep.activate_subscriptions
    migration.modified_at = utc_now() - IDLE
    await save_fixture(migration)
    for source_id, status in [
        ("cus_pending_1", MerchantMigrationRecordStatus.pending),
        ("cus_pending_2", MerchantMigrationRecordStatus.pending),
        ("cus_pending_3", MerchantMigrationRecordStatus.pending),
        ("cus_imported", MerchantMigrationRecordStatus.imported),
        ("cus_skipped", MerchantMigrationRecordStatus.skipped),
    ]:
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=migration,
                organization=organization,
                type=MerchantMigrationRecordType.customer,
                status=status,
                source_id=source_id,
                canonical={"payment_method": {"last4": "4242", "brand": "visa"}},
            )
        )
    return migration


@pytest.mark.anyio
class TestCloseIdle:
    async def test_closes_an_idle_migration(
        self,
        mocker: MockerFixture,
        worker_session: AsyncSession,
        idle_migration: MerchantMigration,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.CLOSE_DELETE_BATCH_SIZE", 2)
        credentials = dict(idle_migration.source_credentials)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.completed
        assert idle_migration.source_credentials == {
            key: value
            for key, value in credentials.items()
            if key != "api_key_encrypted"
        }
        assert idle_migration.source_connected is True
        assert await record_source_ids(worker_session, idle_migration) == {
            "cus_imported",
            "cus_skipped",
        }

    async def test_keeps_imported_card_details(
        self, worker_session: AsyncSession, idle_migration: MerchantMigration
    ) -> None:
        await merchant_migration_close_idle()

        repository = MerchantMigrationRecordRepository.from_session(worker_session)
        imported = await repository.get_one(
            repository.get_base_statement().where(
                MerchantMigrationRecord.merchant_migration_id == idle_migration.id,
                MerchantMigrationRecord.source_id == "cus_imported",
            )
        )
        await worker_session.flush()
        await worker_session.refresh(imported)
        assert imported.canonical == {
            "payment_method": {"last4": "4242", "brand": "visa"}
        }

    async def test_idempotent(
        self, worker_session: AsyncSession, idle_migration: MerchantMigration
    ) -> None:
        await merchant_migration_close_idle()
        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        closed_at = idle_migration.modified_at

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.completed
        assert idle_migration.modified_at == closed_at
        assert await record_source_ids(worker_session, idle_migration) == {
            "cus_imported",
            "cus_skipped",
        }

    async def test_finishes_an_interrupted_close(
        self, worker_session: AsyncSession, idle_migration: MerchantMigration
    ) -> None:
        idle_since = utc_now() - settings.MERCHANT_MIGRATION_IDLE_RETENTION_PERIOD
        idle_at = idle_migration.modified_at
        await merchant_migration_service.close_idle(
            worker_session, idle_migration.id, idle_since=idle_since
        )
        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert "api_key_encrypted" not in idle_migration.source_credentials
        assert idle_migration.modified_at == idle_at

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.completed
        assert await record_source_ids(worker_session, idle_migration) == {
            "cus_imported",
            "cus_skipped",
        }

    async def test_skips_a_recently_active_migration(
        self,
        worker_session: AsyncSession,
        save_fixture: SaveFixture,
        idle_migration: MerchantMigration,
    ) -> None:
        idle_migration.modified_at = (
            utc_now()
            - settings.MERCHANT_MIGRATION_IDLE_RETENTION_PERIOD
            + timedelta(days=1)
        )
        await save_fixture(idle_migration)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.activate_subscriptions
        assert idle_migration.source_credentials.get("api_key_encrypted")
        assert len(await record_source_ids(worker_session, idle_migration)) == 5

    async def test_skips_an_active_operation(
        self,
        worker_session: AsyncSession,
        save_fixture: SaveFixture,
        idle_migration: MerchantMigration,
    ) -> None:
        idle_migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now(),
        )
        idle_migration.modified_at = utc_now() - IDLE
        await save_fixture(idle_migration)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.activate_subscriptions
        assert idle_migration.source_credentials.get("api_key_encrypted")
        assert len(await record_source_ids(worker_session, idle_migration)) == 5

    async def test_closes_a_stalled_operation(
        self,
        worker_session: AsyncSession,
        save_fixture: SaveFixture,
        idle_migration: MerchantMigration,
    ) -> None:
        idle_migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now() - IDLE - STALL_THRESHOLD,
        )
        idle_migration.modified_at = utc_now() - IDLE
        await save_fixture(idle_migration)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.step == MerchantMigrationStep.completed

    async def test_skips_a_completed_migration(
        self,
        worker_session: AsyncSession,
        save_fixture: SaveFixture,
        idle_migration: MerchantMigration,
    ) -> None:
        idle_migration.step = MerchantMigrationStep.completed
        idle_migration.modified_at = utc_now() - IDLE
        await save_fixture(idle_migration)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(idle_migration)
        assert idle_migration.source_credentials.get("api_key_encrypted")
        assert len(await record_source_ids(worker_session, idle_migration)) == 5

    async def test_never_modified_uses_created_at(
        self,
        worker_session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = MerchantMigration(
            organization=organization,
            source_platform=MerchantMigrationSourcePlatform.stripe,
            created_at=utc_now() - IDLE,
        )
        await save_fixture(migration)

        await merchant_migration_close_idle()

        await worker_session.flush()
        await worker_session.refresh(migration)
        assert migration.step == MerchantMigrationStep.completed

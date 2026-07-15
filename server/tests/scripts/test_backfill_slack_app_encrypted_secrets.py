import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.models import Organization, SlackApp
from scripts.backfill_slack_app_encrypted_secrets import run_backfill
from tests.fixtures.database import SaveFixture


async def _create_legacy_slack_app(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    slack_app_id: str,
    client_secret: str | None = None,
    signing_secret: str | None = None,
    bot_token: str | None = None,
) -> SlackApp:
    """A row written before dual-write: plaintext secrets, NULL encrypted columns."""
    slack_app = SlackApp(
        organization_id=organization.id,
        display_name="Test",
        slack_app_id=slack_app_id,
        client_id="100.200",
        client_secret=client_secret,
        signing_secret=signing_secret,
        bot_token=bot_token,
    )
    await save_fixture(slack_app)
    return slack_app


async def _reload(session: AsyncSession, slack_app: SlackApp) -> SlackApp:
    session.expunge_all()
    loaded = await session.scalar(select(SlackApp).where(SlackApp.id == slack_app.id))
    assert loaded is not None
    return loaded


@pytest.mark.asyncio
class TestBackfillSlackAppEncryptedSecrets:
    async def test_encrypts_legacy_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture,
            organization,
            slack_app_id="A1",
            client_secret="cs-legacy",
            signing_secret="ss-legacy",
            bot_token="xoxb-legacy",
        )
        assert slack_app.client_secret_encrypted is None
        assert slack_app.signing_secret_encrypted is None
        assert slack_app.bot_token_encrypted is None

        encrypted = await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        assert encrypted == 1
        loaded = await _reload(session, slack_app)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id))
            == "cs-legacy"
        )
        assert isinstance(loaded.signing_secret_encrypted, EncryptedString)
        assert (
            await loaded.signing_secret_encrypted.decrypt(id=str(loaded.id))
            == "ss-legacy"
        )
        assert isinstance(loaded.bot_token_encrypted, EncryptedString)
        assert (
            await loaded.bot_token_encrypted.decrypt(id=str(loaded.id)) == "xoxb-legacy"
        )

    async def test_encrypts_each_secret_independently(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture,
            organization,
            slack_app_id="A2",
            client_secret="cs-only",
            signing_secret=None,
            bot_token=None,
        )

        await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        loaded = await _reload(session, slack_app)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert loaded.signing_secret_encrypted is None
        assert loaded.bot_token_encrypted is None

    async def test_skips_rows_without_secrets(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture, organization, slack_app_id="A3"
        )

        encrypted = await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        assert encrypted == 0
        loaded = await _reload(session, slack_app)
        assert loaded.client_secret_encrypted is None
        assert loaded.signing_secret_encrypted is None
        assert loaded.bot_token_encrypted is None

    async def test_does_not_overwrite_already_encrypted_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture,
            organization,
            slack_app_id="A4",
            client_secret="cs-plain",
            signing_secret="ss-plain",
        )
        slack_app.client_secret_encrypted = await SlackApp.encrypt_client_secret(
            slack_app.id, "cs-already-encrypted"
        )
        await save_fixture(slack_app)
        assert isinstance(slack_app.client_secret_encrypted, EncryptedString)
        existing_ciphertext = slack_app.client_secret_encrypted.encrypted_value

        await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        loaded = await _reload(session, slack_app)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert loaded.client_secret_encrypted.encrypted_value == existing_ciphertext
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id))
            == "cs-already-encrypted"
        )
        assert isinstance(loaded.signing_secret_encrypted, EncryptedString)
        assert (
            await loaded.signing_secret_encrypted.decrypt(id=str(loaded.id))
            == "ss-plain"
        )

    async def test_processes_multiple_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        for i in range(5):
            await _create_legacy_slack_app(
                save_fixture,
                organization,
                slack_app_id=f"A1{i}",
                client_secret=f"cs-{i}",
            )

        encrypted = await run_backfill(batch_size=2, sleep_seconds=0, session=session)

        assert encrypted == 5
        remaining = await session.execute(
            select(SlackApp).where(
                SlackApp.client_secret.is_not(None),
                SlackApp.client_secret_encrypted.is_(None),
            )
        )
        assert remaining.scalars().first() is None

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture,
            organization,
            slack_app_id="A5",
            client_secret="cs-rerun",
        )

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 1
        loaded = await _reload(session, slack_app)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        first_ciphertext = loaded.client_secret_encrypted.encrypted_value

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 0
        loaded = await _reload(session, slack_app)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert loaded.client_secret_encrypted.encrypted_value == first_ciphertext

    async def test_dry_run_counts_without_writing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        slack_app = await _create_legacy_slack_app(
            save_fixture,
            organization,
            slack_app_id="A6",
            client_secret="cs-dry-run",
        )

        count = await run_backfill(dry_run=True, session=session)

        assert count == 1
        loaded = await _reload(session, slack_app)
        assert loaded.client_secret_encrypted is None

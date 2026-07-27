import pytest
from sqlalchemy import or_, select

from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.models import OAuth2Client, User
from scripts.backfill_oauth2_client_encrypted_secrets import run_backfill
from tests.fixtures.database import SaveFixture


async def _create_legacy_client(
    save_fixture: SaveFixture,
    user: User,
    *,
    client_id: str,
    client_secret: str = "polar_cs_legacy",
    registration_access_token: str = "polar_crt_legacy",
) -> OAuth2Client:
    """A row written before dual-write: plaintext secrets, NULL hash and
    encrypted columns."""
    client = OAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        registration_access_token=registration_access_token,
        user=user,
    )
    await save_fixture(client)
    return client


async def _reload(session: AsyncSession, client: OAuth2Client) -> OAuth2Client:
    session.expunge_all()
    loaded = await session.scalar(
        select(OAuth2Client).where(OAuth2Client.id == client.id)
    )
    assert loaded is not None
    return loaded


@pytest.mark.asyncio
class TestBackfillOAuth2ClientEncryptedSecrets:
    async def test_encrypts_legacy_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        client = await _create_legacy_client(
            save_fixture,
            user,
            client_id="polar_ci_1",
            client_secret="cs-legacy",
            registration_access_token="crt-legacy",
        )
        assert client.client_secret_hash is None
        assert client.client_secret_encrypted is None
        assert client.registration_access_token_hash is None
        assert client.registration_access_token_encrypted is None

        encrypted = await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        assert encrypted == 1
        loaded = await _reload(session, client)
        assert loaded.client_secret_hash == OAuth2Client.hash_secret("cs-legacy")
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id))
            == "cs-legacy"
        )
        assert loaded.registration_access_token_hash == OAuth2Client.hash_secret(
            "crt-legacy"
        )
        assert isinstance(loaded.registration_access_token_encrypted, EncryptedString)
        assert (
            await loaded.registration_access_token_encrypted.decrypt(id=str(loaded.id))
            == "crt-legacy"
        )

    async def test_fills_missing_encrypted_when_hash_present(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """Registration dual-writes the hash synchronously but not the
        ciphertext; the backfill fills only the missing ciphertext."""
        client = await _create_legacy_client(
            save_fixture,
            user,
            client_id="polar_ci_2",
            client_secret="cs-hashed",
            registration_access_token="crt-hashed",
        )
        client.client_secret_hash = OAuth2Client.hash_secret("cs-hashed")
        client.registration_access_token_hash = OAuth2Client.hash_secret("crt-hashed")
        await save_fixture(client)

        await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        loaded = await _reload(session, client)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert isinstance(loaded.registration_access_token_encrypted, EncryptedString)
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id))
            == "cs-hashed"
        )
        assert (
            await loaded.registration_access_token_encrypted.decrypt(id=str(loaded.id))
            == "crt-hashed"
        )

    async def test_does_not_overwrite_already_encrypted_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        client = await _create_legacy_client(save_fixture, user, client_id="polar_ci_3")
        client.client_secret_encrypted = await OAuth2Client.encrypt_client_secret(
            client.id, "cs-already-encrypted"
        )
        await save_fixture(client)
        assert isinstance(client.client_secret_encrypted, EncryptedString)
        existing_ciphertext = client.client_secret_encrypted.encrypted_value

        await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        loaded = await _reload(session, client)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert loaded.client_secret_encrypted.encrypted_value == existing_ciphertext
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id))
            == "cs-already-encrypted"
        )

    async def test_processes_multiple_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        for i in range(5):
            await _create_legacy_client(
                save_fixture, user, client_id=f"polar_ci_batch_{i}"
            )

        encrypted = await run_backfill(batch_size=2, sleep_seconds=0, session=session)

        assert encrypted == 5
        remaining = await session.execute(
            select(OAuth2Client).where(
                or_(
                    OAuth2Client.client_secret_encrypted.is_(None),
                    OAuth2Client.registration_access_token_encrypted.is_(None),
                )
            )
        )
        assert remaining.scalars().first() is None

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        client = await _create_legacy_client(
            save_fixture, user, client_id="polar_ci_rerun"
        )

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 1
        loaded = await _reload(session, client)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        first_ciphertext = loaded.client_secret_encrypted.encrypted_value

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 0
        loaded = await _reload(session, client)
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert loaded.client_secret_encrypted.encrypted_value == first_ciphertext

    async def test_dry_run_counts_without_writing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        client = await _create_legacy_client(
            save_fixture, user, client_id="polar_ci_dry_run"
        )

        count = await run_backfill(dry_run=True, session=session)

        assert count == 1
        loaded = await _reload(session, client)
        assert loaded.client_secret_encrypted is None

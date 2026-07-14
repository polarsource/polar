import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy import select

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.encryption import EncryptedString
from polar.models import OAuth2Client, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _build(user: User) -> OAuth2Client:
    client = OAuth2Client(
        client_id="polar_ci_test",
        client_secret="polar_cs_test",
        registration_access_token="polar_crt_test",
        user=user,
    )
    client.id = OAuth2Client.generate_id()
    return client


class TestHashSecret:
    def test_hashes_with_secret(self) -> None:
        assert OAuth2Client.hash_secret("polar_cs_test") == get_token_hash(
            "polar_cs_test", secret=settings.SECRET
        )

    def test_is_deterministic(self) -> None:
        assert OAuth2Client.hash_secret("polar_cs_test") == OAuth2Client.hash_secret(
            "polar_cs_test"
        )

    def test_none_returns_none(self) -> None:
        assert OAuth2Client.hash_secret(None) is None


@pytest.mark.asyncio
class TestEncryptClassmethods:
    async def test_encrypt_client_secret(self, user: User) -> None:
        client = _build(user)

        encrypted = await OAuth2Client.encrypt_client_secret(client.id, "cs-test")

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(client.id)) == "cs-test"

    async def test_encrypt_registration_access_token(self, user: User) -> None:
        client = _build(user)

        encrypted = await OAuth2Client.encrypt_registration_access_token(
            client.id, "crt-test"
        )

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(client.id)) == "crt-test"

    async def test_encrypt_none_returns_none(self) -> None:
        row_id = OAuth2Client.generate_id()
        assert await OAuth2Client.encrypt_client_secret(row_id, None) is None
        assert (
            await OAuth2Client.encrypt_registration_access_token(row_id, None) is None
        )

    async def test_binds_ciphertext_to_row_id(self, user: User) -> None:
        client = _build(user)

        encrypted = await OAuth2Client.encrypt_client_secret(client.id, "cs-test")

        assert isinstance(encrypted, EncryptedString)
        with pytest.raises(InvalidTag):
            await encrypted.decrypt(id="not-the-row-id")

    async def test_encrypt_sync_variants_roundtrip(self, user: User) -> None:
        client = _build(user)

        client_secret = OAuth2Client.encrypt_client_secret_sync(client.id, "cs-test")
        registration_access_token = OAuth2Client.encrypt_registration_access_token_sync(
            client.id, "crt-test"
        )

        assert isinstance(client_secret, EncryptedString)
        assert isinstance(registration_access_token, EncryptedString)
        assert await client_secret.decrypt(id=str(client.id)) == "cs-test"
        assert await registration_access_token.decrypt(id=str(client.id)) == "crt-test"

    def test_encrypt_sync_none_returns_none(self) -> None:
        row_id = OAuth2Client.generate_id()
        assert OAuth2Client.encrypt_client_secret_sync(row_id, None) is None
        assert OAuth2Client.encrypt_registration_access_token_sync(row_id, None) is None


@pytest.mark.asyncio
class TestSetters:
    async def test_set_client_secret_writes_all_copies(self, user: User) -> None:
        client = _build(user)

        await client.set_client_secret("cs-new")

        assert client.client_secret == "cs-new"
        assert client.client_secret_hash == OAuth2Client.hash_secret("cs-new")
        assert isinstance(client.client_secret_encrypted, EncryptedString)
        assert (
            await client.client_secret_encrypted.decrypt(id=str(client.id)) == "cs-new"
        )

    async def test_set_registration_access_token_writes_all_copies(
        self, user: User
    ) -> None:
        client = _build(user)

        await client.set_registration_access_token("crt-new")

        assert client.registration_access_token == "crt-new"
        assert client.registration_access_token_hash == OAuth2Client.hash_secret(
            "crt-new"
        )
        assert isinstance(client.registration_access_token_encrypted, EncryptedString)
        assert (
            await client.registration_access_token_encrypted.decrypt(id=str(client.id))
            == "crt-new"
        )


@pytest.mark.asyncio
class TestPersistence:
    async def test_round_trip_through_database(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        client = _build(user)
        await client.set_client_secret("cs-test")
        await client.set_registration_access_token("crt-test")
        await save_fixture(client)
        client_id = client.id

        session.expunge_all()
        loaded = await session.scalar(
            select(OAuth2Client).where(OAuth2Client.id == client_id)
        )

        assert loaded is not None
        assert loaded.client_secret_hash == OAuth2Client.hash_secret("cs-test")
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert await loaded.client_secret_encrypted.decrypt(id=str(loaded.id)) == (
            "cs-test"
        )
        assert loaded.registration_access_token_hash == OAuth2Client.hash_secret(
            "crt-test"
        )
        assert isinstance(loaded.registration_access_token_encrypted, EncryptedString)
        assert await loaded.registration_access_token_encrypted.decrypt(
            id=str(loaded.id)
        ) == ("crt-test")

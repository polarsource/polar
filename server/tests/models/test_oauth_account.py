import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy import select

from polar.kit.encryption import EncryptedString
from polar.models import User
from polar.models.user import OAuthAccount, OAuthPlatform
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def _build(user: User) -> OAuthAccount:
    return OAuthAccount(
        platform=OAuthPlatform.github,
        account_id="account-id",
        account_email="foo@bar.com",
        account_username="foo",
        user=user,
    )


@pytest.mark.asyncio
class TestSetTokens:
    async def test_dual_writes_plain_and_encrypted(self, user: User) -> None:
        oauth_account = await _build(user)

        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )

        assert oauth_account.access_token == "the-access-token"
        assert oauth_account.refresh_token == "the-refresh-token"
        assert isinstance(oauth_account.access_token_encrypted, EncryptedString)
        assert isinstance(oauth_account.refresh_token_encrypted, EncryptedString)
        assert (
            await oauth_account.access_token_encrypted.decrypt(id=str(oauth_account.id))
            == "the-access-token"
        )
        assert (
            await oauth_account.refresh_token_encrypted.decrypt(
                id=str(oauth_account.id)
            )
            == "the-refresh-token"
        )

    async def test_binds_ciphertext_to_row_id(self, user: User) -> None:
        oauth_account = await _build(user)

        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )

        assert isinstance(oauth_account.access_token_encrypted, EncryptedString)
        with pytest.raises(InvalidTag):
            await oauth_account.access_token_encrypted.decrypt(id="not-the-row-id")

    async def test_clears_encrypted_when_refresh_none(self, user: User) -> None:
        oauth_account = await _build(user)
        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )

        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token=None
        )

        assert oauth_account.refresh_token is None
        assert oauth_account.refresh_token_encrypted is None


@pytest.mark.asyncio
class TestEncryptClassmethods:
    """Covers the classmethods used by the Core ``update().values()`` write
    paths in factor.py / apple.py, which don't go through the instance setters."""

    async def test_encrypt_access_token(self, user: User) -> None:
        oauth_account = await _build(user)
        oauth_account.id = OAuthAccount.generate_id()

        encrypted = await OAuthAccount.encrypt_access_token(
            oauth_account.id, "the-access-token"
        )

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(oauth_account.id)) == "the-access-token"

    async def test_encrypt_refresh_token_with_value(self, user: User) -> None:
        oauth_account = await _build(user)
        oauth_account.id = OAuthAccount.generate_id()

        encrypted = await OAuthAccount.encrypt_refresh_token(
            oauth_account.id, "the-refresh-token"
        )

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(oauth_account.id)) == "the-refresh-token"

    async def test_encrypt_refresh_token_none_returns_none(self, user: User) -> None:
        assert (
            await OAuthAccount.encrypt_refresh_token(OAuthAccount.generate_id(), None)
            is None
        )


@pytest.mark.asyncio
class TestGetTokens:
    async def test_prefers_encrypted(self, user: User) -> None:
        oauth_account = await _build(user)
        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )

        assert await oauth_account.get_access_token() == "the-access-token"
        assert await oauth_account.get_refresh_token() == "the-refresh-token"

    async def test_falls_back_to_plain(self, user: User) -> None:
        oauth_account = await _build(user)
        oauth_account.id = OAuthAccount.generate_id()
        oauth_account.access_token = "the-access-token"
        oauth_account.refresh_token = "the-refresh-token"

        assert await oauth_account.get_access_token() == "the-access-token"
        assert await oauth_account.get_refresh_token() == "the-refresh-token"

    async def test_refresh_token_none_without_encrypted(self, user: User) -> None:
        oauth_account = await _build(user)
        oauth_account.id = OAuthAccount.generate_id()
        oauth_account.access_token = "the-access-token"
        oauth_account.refresh_token = None

        assert await oauth_account.get_refresh_token() is None

    async def test_to_dataclass_decrypts_tokens(self, user: User) -> None:
        oauth_account = await _build(user)
        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )

        enrollment = await oauth_account.to_dataclass(["scope"])

        assert enrollment.access_token == "the-access-token"
        assert enrollment.refresh_token == "the-refresh-token"


@pytest.mark.asyncio
class TestPersistence:
    async def test_round_trip_through_database(
        self, save_fixture: SaveFixture, session: AsyncSession, user: User
    ) -> None:
        oauth_account = await _build(user)
        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )
        await save_fixture(oauth_account)
        oauth_account_id = oauth_account.id

        session.expunge_all()
        loaded = await session.scalar(
            select(OAuthAccount).where(OAuthAccount.id == oauth_account_id)
        )
        assert loaded is not None

        assert isinstance(loaded.access_token_encrypted, EncryptedString)
        assert (
            await loaded.access_token_encrypted.decrypt(id=str(loaded.id))
            == "the-access-token"
        )
        assert isinstance(loaded.refresh_token_encrypted, EncryptedString)
        assert (
            await loaded.refresh_token_encrypted.decrypt(id=str(loaded.id))
            == "the-refresh-token"
        )

    async def test_clearing_refresh_token_persists_null(
        self, save_fixture: SaveFixture, session: AsyncSession, user: User
    ) -> None:
        oauth_account = await _build(user)
        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token="the-refresh-token"
        )
        await save_fixture(oauth_account)
        oauth_account_id = oauth_account.id

        await oauth_account.set_tokens(
            access_token="the-access-token", refresh_token=None
        )
        await save_fixture(oauth_account)

        session.expunge_all()
        loaded = await session.scalar(
            select(OAuthAccount).where(OAuthAccount.id == oauth_account_id)
        )
        assert loaded is not None
        assert loaded.refresh_token is None
        assert loaded.refresh_token_encrypted is None

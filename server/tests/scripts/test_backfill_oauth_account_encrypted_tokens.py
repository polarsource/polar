import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.models import User
from polar.models.user import OAuthAccount, OAuthPlatform
from scripts.backfill_oauth_account_encrypted_tokens import run_backfill
from tests.fixtures.database import SaveFixture


async def _create_legacy_oauth_account(
    save_fixture: SaveFixture,
    user: User,
    *,
    account_id: str,
    access_token: str,
    refresh_token: str | None = None,
) -> OAuthAccount:
    """A row written before dual-write: plaintext tokens, NULL encrypted columns."""
    oauth_account = OAuthAccount(
        platform=OAuthPlatform.github,
        account_id=account_id,
        account_email=f"{account_id}@example.com",
        account_username=account_id,
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )
    await save_fixture(oauth_account)
    return oauth_account


async def _reload(session: AsyncSession, oauth_account: OAuthAccount) -> OAuthAccount:
    session.expunge_all()
    loaded = await session.scalar(
        select(OAuthAccount).where(OAuthAccount.id == oauth_account.id)
    )
    assert loaded is not None
    return loaded


@pytest.mark.asyncio
class TestBackfillOAuthAccountEncryptedTokens:
    async def test_encrypts_legacy_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        oauth_account = await _create_legacy_oauth_account(
            save_fixture,
            user,
            account_id="legacy",
            access_token="the-access-token",
            refresh_token="the-refresh-token",
        )
        assert oauth_account.access_token_encrypted is None
        assert oauth_account.refresh_token_encrypted is None

        encrypted = await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        assert encrypted == 1
        loaded = await _reload(session, oauth_account)
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

    async def test_leaves_null_refresh_token_null(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        oauth_account = await _create_legacy_oauth_account(
            save_fixture,
            user,
            account_id="no-refresh",
            access_token="the-access-token",
            refresh_token=None,
        )

        await run_backfill(batch_size=10, sleep_seconds=0, session=session)

        loaded = await _reload(session, oauth_account)
        assert isinstance(loaded.access_token_encrypted, EncryptedString)
        assert loaded.refresh_token_encrypted is None

    async def test_processes_multiple_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        for i in range(5):
            await _create_legacy_oauth_account(
                save_fixture,
                user,
                account_id=f"acc-{i}",
                access_token=f"token-{i}",
            )

        encrypted = await run_backfill(batch_size=2, sleep_seconds=0, session=session)

        assert encrypted == 5
        remaining = await session.execute(
            select(OAuthAccount).where(OAuthAccount.access_token_encrypted.is_(None))
        )
        assert remaining.scalars().first() is None

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        oauth_account = await _create_legacy_oauth_account(
            save_fixture,
            user,
            account_id="rerun",
            access_token="the-access-token",
        )

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 1
        loaded = await _reload(session, oauth_account)
        assert isinstance(loaded.access_token_encrypted, EncryptedString)
        first_ciphertext = loaded.access_token_encrypted.encrypted_value

        assert await run_backfill(batch_size=10, sleep_seconds=0, session=session) == 0
        loaded = await _reload(session, oauth_account)
        assert isinstance(loaded.access_token_encrypted, EncryptedString)
        assert loaded.access_token_encrypted.encrypted_value == first_ciphertext

    async def test_dry_run_counts_without_writing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        oauth_account = await _create_legacy_oauth_account(
            save_fixture,
            user,
            account_id="dry-run",
            access_token="the-access-token",
        )

        count = await run_backfill(dry_run=True, session=session)

        assert count == 1
        loaded = await _reload(session, oauth_account)
        assert loaded.access_token_encrypted is None

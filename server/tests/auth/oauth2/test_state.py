import pytest
from sqlalchemy import select

from polar.auth.oauth2.state import OAuth2StateService
from polar.kit.utils import utc_now
from polar.models import OAuth2State
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def create_oauth2_state(
    save_fixture: SaveFixture, *, state_hash: str, expires_at: int
) -> OAuth2State:
    oauth2_state = OAuth2State(
        state_hash=state_hash,
        provider="google",
        code_verifier="code-verifier",
        nonce="nonce",
        redirect_uri="https://example.com/callback",
        scope=["openid", "email"],
        expires_at=expires_at,
        identity_id=None,
        context={"return_to": "/dashboard"},
    )
    await save_fixture(oauth2_state)
    return oauth2_state


@pytest.mark.asyncio
class TestDeleteExpired:
    async def test_deletes_only_expired(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        now = int(utc_now().timestamp())
        expired = await create_oauth2_state(
            save_fixture, state_hash="e" * 64, expires_at=now - 3600
        )
        valid = await create_oauth2_state(
            save_fixture, state_hash="v" * 64, expires_at=now + 3600
        )

        await OAuth2StateService(session).delete_expired()

        result = await session.execute(select(OAuth2State.id))
        remaining = set(result.scalars().all())
        assert expired.id not in remaining
        assert valid.id in remaining

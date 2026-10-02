import pytest
from sqlalchemy import select

from polar.models import OAuthAccount
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.oauth_service import (
    CannotDisconnectLastAuthMethod,
    oauth_account_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_oauth_account, create_user


@pytest.mark.asyncio
class TestDisconnectPlatform:
    async def test_sole_account_email_verified(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        user = await create_user(save_fixture, email_verified=True)
        await create_oauth_account(save_fixture, user, OAuthPlatform.google)

        await oauth_account_service.disconnect_platform(
            session, user, OAuthPlatform.google
        )

        result = await session.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user.id)
        )
        assert result.scalars().all() == []

    async def test_sole_account_email_not_verified(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        user = await create_user(save_fixture, email_verified=False)
        await create_oauth_account(save_fixture, user, OAuthPlatform.google)

        with pytest.raises(CannotDisconnectLastAuthMethod):
            await oauth_account_service.disconnect_platform(
                session, user, OAuthPlatform.google
            )

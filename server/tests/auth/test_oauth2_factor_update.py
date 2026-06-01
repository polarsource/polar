import pytest

from polar.auth.oauth2.apple import AppleFactor
from polar.auth.oauth2.factor import OAuth2FactorMixin
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


class DummyOAuth2Factor(OAuth2FactorMixin):
    identifier = OAuthPlatform.github

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_profile(self, access_token: str) -> dict[str, str]:
        return {"name": "updated-username"}

    async def get_email(self, callback_result: object) -> str:
        return "updated@example.com"


async def create_oauth_account(
    save_fixture: SaveFixture,
    user: User,
    *,
    platform: OAuthPlatform,
    account_id: str,
    access_token: str,
    account_email: str,
    account_username: str | None,
) -> OAuthAccount:
    oauth_account = OAuthAccount(
        platform=platform,
        access_token=access_token,
        expires_at=1,
        refresh_token="original-refresh-token",
        refresh_token_expires_at=2,
        account_id=account_id,
        account_email=account_email,
        account_username=account_username,
        user=user,
    )
    await save_fixture(oauth_account)
    return oauth_account


@pytest.mark.asyncio
class TestOAuth2FactorUpdate:
    async def test_mixin_updates_only_target_enrollment(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
    ) -> None:
        enrollment_1 = await create_oauth_account(
            save_fixture,
            user,
            platform=OAuthPlatform.github,
            account_id="github-account-1",
            access_token="original-token-1",
            account_email="original-1@example.com",
            account_username="original-username-1",
        )
        enrollment_2 = await create_oauth_account(
            save_fixture,
            user,
            platform=OAuthPlatform.github,
            account_id="github-account-2",
            access_token="original-token-2",
            account_email="original-2@example.com",
            account_username="original-username-2",
        )

        enrollment_dataclass = enrollment_1.to_dataclass(["user", "user:email"])
        enrollment_dataclass.access_token = "updated-token"
        enrollment_dataclass.expires_at = 11
        enrollment_dataclass.refresh_token = "updated-refresh-token"
        enrollment_dataclass.refresh_token_expires_at = 22

        factor = DummyOAuth2Factor(session)
        await factor.update(enrollment_dataclass)

        updated_enrollment_1 = await session.get(OAuthAccount, enrollment_1.id)
        assert updated_enrollment_1 is not None
        assert updated_enrollment_1.access_token == "updated-token"
        assert updated_enrollment_1.expires_at == 11
        assert updated_enrollment_1.refresh_token == "updated-refresh-token"
        assert updated_enrollment_1.refresh_token_expires_at == 22
        assert updated_enrollment_1.account_email == "updated@example.com"
        assert updated_enrollment_1.account_username == "updated-username"

        untouched_enrollment_2 = await session.get(OAuthAccount, enrollment_2.id)
        assert untouched_enrollment_2 is not None
        assert untouched_enrollment_2.access_token == "original-token-2"
        assert untouched_enrollment_2.expires_at == 1
        assert untouched_enrollment_2.refresh_token == "original-refresh-token"
        assert untouched_enrollment_2.refresh_token_expires_at == 2
        assert untouched_enrollment_2.account_email == "original-2@example.com"
        assert untouched_enrollment_2.account_username == "original-username-2"

    async def test_apple_factor_updates_only_target_enrollment(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
    ) -> None:
        enrollment_1 = await create_oauth_account(
            save_fixture,
            user,
            platform=OAuthPlatform.apple,
            account_id="apple-account-1",
            access_token="original-token-1",
            account_email="apple-1@example.com",
            account_username="apple-username-1",
        )
        enrollment_2 = await create_oauth_account(
            save_fixture,
            user,
            platform=OAuthPlatform.apple,
            account_id="apple-account-2",
            access_token="original-token-2",
            account_email="apple-2@example.com",
            account_username="apple-username-2",
        )

        enrollment_dataclass = enrollment_1.to_dataclass(["openid", "email", "name"])
        enrollment_dataclass.access_token = "updated-token"
        enrollment_dataclass.expires_at = 111
        enrollment_dataclass.refresh_token = "updated-refresh-token"
        enrollment_dataclass.refresh_token_expires_at = 222

        factor = AppleFactor.__new__(AppleFactor)
        factor.session = session
        factor.identifier = AppleFactor.IDENTIFIER
        await factor.update(enrollment_dataclass)

        updated_enrollment_1 = await session.get(OAuthAccount, enrollment_1.id)
        assert updated_enrollment_1 is not None
        assert updated_enrollment_1.access_token == "updated-token"
        assert updated_enrollment_1.expires_at == 111
        assert updated_enrollment_1.refresh_token == "updated-refresh-token"
        assert updated_enrollment_1.refresh_token_expires_at == 222
        assert updated_enrollment_1.account_email == "apple-1@example.com"
        assert updated_enrollment_1.account_username == "apple-username-1"

        untouched_enrollment_2 = await session.get(OAuthAccount, enrollment_2.id)
        assert untouched_enrollment_2 is not None
        assert untouched_enrollment_2.access_token == "original-token-2"
        assert untouched_enrollment_2.expires_at == 1
        assert untouched_enrollment_2.refresh_token == "original-refresh-token"
        assert untouched_enrollment_2.refresh_token_expires_at == 2
        assert untouched_enrollment_2.account_email == "apple-2@example.com"
        assert untouched_enrollment_2.account_username == "apple-username-2"

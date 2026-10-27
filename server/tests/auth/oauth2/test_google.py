import pytest
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account

from polar.auth.exceptions import UnverifiedEmailError
from polar.auth.oauth2.google import GoogleFactor
from polar.auth.oauth2.state import OAuth2StateService
from polar.postgres import AsyncSession


@pytest.mark.anyio
class TestGoogleGetEmail:
    @pytest.mark.parametrize("use_id_token", [True, False])
    @pytest.mark.parametrize("verified", [True, False])
    async def test_email_verification(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        oauth_account: OAuth2Account,
        use_id_token: bool,
        verified: bool,
    ) -> None:
        factor = GoogleFactor(session, OAuth2StateService(session))
        oauth_account.id_token = "id-token" if use_id_token else None
        get_claims = mocker.patch.object(
            factor,
            "get_id_token_claims",
            return_value={"email": "jane@example.com", "email_verified": verified},
        )
        get_profile = mocker.patch.object(
            factor,
            "get_profile",
            return_value={"email": "jane@example.com", "email_verified": verified},
        )

        if verified:
            assert await factor.get_email(oauth_account) == "jane@example.com"
        else:
            with pytest.raises(UnverifiedEmailError):
                await factor.get_email(oauth_account)

        if use_id_token:
            get_claims.assert_awaited_once_with("id-token")
            get_profile.assert_not_awaited()
        else:
            get_profile.assert_awaited_once_with("access-token")
            get_claims.assert_not_awaited()

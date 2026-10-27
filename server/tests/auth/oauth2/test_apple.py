import pytest
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account

from polar.auth.exceptions import UnverifiedEmailError
from polar.auth.oauth2.apple import AppleFactor
from polar.auth.oauth2.state import OAuth2StateService
from polar.postgres import AsyncSession


@pytest.mark.anyio
class TestAppleGetEmail:
    @pytest.mark.parametrize("verified", [True, False])
    async def test_email_verification(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        oauth_account: OAuth2Account,
        verified: bool,
    ) -> None:
        factor = AppleFactor(session, OAuth2StateService(session))
        oauth_account.provider = "apple"
        oauth_account.id_token = "id-token"
        mocker.patch.object(
            factor,
            "get_id_token_claims",
            return_value={"email": "jane@example.com", "email_verified": verified},
        )

        if verified:
            assert await factor.get_email(oauth_account) == "jane@example.com"
        else:
            with pytest.raises(UnverifiedEmailError):
                await factor.get_email(oauth_account)

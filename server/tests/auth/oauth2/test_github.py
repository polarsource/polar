import pytest
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account

from polar.auth.exceptions import UnverifiedEmailError
from polar.auth.oauth2.github import GitHubFactor
from polar.auth.oauth2.state import OAuth2StateService
from polar.postgres import AsyncSession


@pytest.mark.anyio
class TestGitHubGetEmail:
    @pytest.mark.parametrize("verified", [True, False])
    async def test_primary_email_verification(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        oauth_account: OAuth2Account,
        verified: bool,
    ) -> None:
        factor = GitHubFactor(session, OAuth2StateService(session))
        oauth_account.provider = "github"
        mocker.patch.object(
            factor,
            "get_emails",
            return_value=[
                {
                    "email": "secondary@example.com",
                    "primary": False,
                    "verified": True,
                    "visibility": "private",
                },
                {
                    "email": "jane@example.com",
                    "primary": True,
                    "verified": verified,
                    "visibility": "private",
                },
            ],
        )

        if verified:
            assert await factor.get_email(oauth_account) == "jane@example.com"
        else:
            with pytest.raises(UnverifiedEmailError):
                await factor.get_email(oauth_account)

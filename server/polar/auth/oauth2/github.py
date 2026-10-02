from fastapi import Depends
from reauth.factors.oauth2.base import OAuth2Account
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from reauth.factors.oauth2.github import GitHubOAuth2Factor as GitHubOAuth2FactorBase
from reauth.factors.oauth2.github import GitHubOAuth2GetEmailsException

from polar.config import settings
from polar.postgres import AsyncSession, get_db_session

from ..exceptions import GetEmailError
from .factor import OAuth2FactorMixin
from .state import OAuth2StateService, get_oauth2_state_service


class GitHubFactor(OAuth2FactorMixin, GitHubOAuth2FactorBase):
    IDENTIFIER = "github"
    SCOPE = ["user", "user:email"]

    def __init__(
        self, session: AsyncSession, state_service: OAuth2StateService
    ) -> None:
        self.session = session
        super().__init__(
            identifier=self.IDENTIFIER,
            state_service=state_service,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        )

    async def get_email(
        self, callback_result: OAuth2EnrollmentDataclass | OAuth2Account
    ) -> str:
        email, _ = await self.get_email_and_verified(callback_result)
        return email

    async def get_email_and_verified(
        self, callback_result: OAuth2EnrollmentDataclass | OAuth2Account
    ) -> tuple[str, bool]:
        try:
            emails = await self.get_emails(callback_result.access_token)
        except (KeyError, GitHubOAuth2GetEmailsException) as e:
            raise GetEmailError() from e

        for email in emails:
            if email.get("primary"):
                return email["email"], email.get("verified") is True
        raise GetEmailError()


async def get_github_factor(
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> GitHubFactor:
    return GitHubFactor(session, state_service)

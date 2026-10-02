from fastapi import Depends
from reauth.factors.oauth2.base import OAuth2Account
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from reauth.factors.oauth2.github import GitHubOAuth2Factor as GitHubOAuth2FactorBase
from reauth.factors.oauth2.github import (
    GitHubOAuth2GetEmailsException,
    get_primary_email,
)

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
        try:
            emails = await self.get_emails(callback_result.access_token)
            return get_primary_email(emails)
        except (KeyError, GitHubOAuth2GetEmailsException) as e:
            raise GetEmailError() from e


async def get_github_factor(
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> GitHubFactor:
    return GitHubFactor(session, state_service)

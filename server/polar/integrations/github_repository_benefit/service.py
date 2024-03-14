import structlog
from httpx_oauth.oauth2 import OAuth2Token

import polar.integrations.github.client as github
from polar.exceptions import BadRequest, PolarError
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class DiscordError(PolarError):
    ...


class GitHubRepositoryBenefitAccountNotConnected(DiscordError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "You don't have a GitHubRepositoryBenefit account connected."
        super().__init__(message)


class GitHubRepositoryBenefitExpiredAccessToken(DiscordError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "The access token is expired and no refresh token is available."
        super().__init__(message, 401)


class GitHubRepositoryBenefitUserService:
    async def create_oauth_account(
        self, session: AsyncSession, user: User, oauth2_token_data: OAuth2Token
    ) -> OAuthAccount:
        access_token = oauth2_token_data["access_token"]

        client = github.get_client(access_token=access_token)
        user_data = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(user_data)

        if not user_data.parsed_data.email:
            raise BadRequest("connected github user doesn't have an email address")

        account_id = user_data.parsed_data.id
        account_email = user_data.parsed_data.email
        account_username = user_data.parsed_data.login

        oauth_account = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token=access_token,
            expires_at=oauth2_token_data["expires_at"],
            refresh_token=oauth2_token_data["refresh_token"],
            account_id=str(account_id),
            account_email=account_email,
            account_username=account_username,
            user=user,
        )
        session.add(oauth_account)
        await session.commit()

        return oauth_account

    async def update_user_info(
        self,
        session: AsyncSession,
        oauth_account: OAuthAccount,
    ) -> OAuthAccount:
        client = github.get_client(access_token=oauth_account.access_token)
        user_data = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(user_data)

        if not user_data.parsed_data.email:
            raise BadRequest("connected github user doesn't have an email address")

        oauth_account.account_email = user_data.parsed_data.email
        oauth_account.account_username = user_data.parsed_data.login

        session.add(oauth_account)

        return oauth_account

    async def get_oauth_account(self, user: User) -> OAuthAccount:
        account = user.get_oauth_account(OAuthPlatform.github_repository_benefit)
        if account is None:
            raise GitHubRepositoryBenefitAccountNotConnected(user)
        return account


github_repository_benefit_user_service = GitHubRepositoryBenefitUserService()

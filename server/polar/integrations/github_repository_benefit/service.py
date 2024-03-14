import time

import structlog
from githubkit import GitHub
from httpx_oauth.oauth2 import OAuth2Token

import polar.integrations.github.client as github
from polar.config import settings
from polar.exceptions import BadRequest, PolarError
from polar.integrations.github import types
from polar.integrations.github_repository_benefit.schemas import (
    GitHubInvitesBenefitRepository,
)
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

    async def get_oauth_account(
        self, session: AsyncSession, user: User
    ) -> OAuthAccount:
        account = user.get_oauth_account(OAuthPlatform.github_repository_benefit)
        if account is None:
            raise GitHubRepositoryBenefitAccountNotConnected(user)

        # if token expires within 30 minutes, refresh it
        if (
            account.expires_at
            and account.refresh_token
            and account.expires_at <= (time.time() + 60 * 30)
        ):
            refresh = await GitHub().arequest(
                method="POST",
                url="https://github.com/login/oauth/access_token",
                params={
                    "client_id": settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
                    "client_secret": settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
                    "refresh_token": account.refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Accept": "application/json"},
                response_model=github.RefreshAccessToken,
            )

            if refresh:
                r = refresh.parsed_data
                # update
                account.access_token = r.access_token
                account.expires_at = int(time.time()) + r.expires_in
                if r.refresh_token:
                    account.refresh_token = r.refresh_token

                log.info(
                    "github.auth.refresh.succeeded",
                    user_id=account.user_id,
                    platform=account.platform,
                )
                session.add(account)

        return account

    async def list_repositories(
        self, oauth: OAuthAccount
    ) -> list[GitHubInvitesBenefitRepository]:
        client = github.get_client(access_token=oauth.access_token)
        # await client.rest.apps.async_list_installations_for_authenticated_user()

        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

        def map_installations_func(
            r: github.Response[types.UserInstallationsGetResponse200],
        ) -> list[types.Installation]:
            return r.parsed_data.installations

        # client = await github.get_user_client(session, user)
        installations: list[types.Installation] = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=map_installations_func,
        ):
            installations.append(install)

        res: list[GitHubInvitesBenefitRepository] = []

        def map_repos_func(
            r: github.Response[
                types.UserInstallationsInstallationIdRepositoriesGetResponse200
            ],
        ) -> list[types.Repository]:
            return r.parsed_data.repositories

        # get repos
        for install in installations:
            if install.account is None:
                continue
            if not isinstance(install.account, types.SimpleUser):
                continue

            async for repo in client.paginate(
                client.rest.apps.async_list_installation_repos_for_authenticated_user,
                map_func=map_repos_func,
                installation_id=install.id,
            ):
                # repo: types.Repository = repo
                res.append(
                    GitHubInvitesBenefitRepository(
                        organization_name=install.account.login,
                        repository_name=repo.name,
                    )
                )
                # installations.append(install)

        return res


github_repository_benefit_user_service = GitHubRepositoryBenefitUserService()

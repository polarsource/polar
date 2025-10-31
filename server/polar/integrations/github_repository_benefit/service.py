from typing import TYPE_CHECKING

import structlog
from githubkit.exception import GitHubException
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.oauth2 import OAuth2Token, RefreshTokenError
from sqlalchemy.exc import IntegrityError

import polar.integrations.github.client as github
from polar.config import settings
from polar.exceptions import PolarError, ResourceAlreadyExists
from polar.integrations.github.service.user import github_user as github_user_service
from polar.integrations.github_repository_benefit.schemas import (
    GitHubInvitesBenefitOrganization,
    GitHubInvitesBenefitRepository,
)
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.redis import Redis

from .types import SimpleUser

if TYPE_CHECKING:
    from . import types

log: Logger = structlog.get_logger()

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
    settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
)


class GitHubError(PolarError): ...


class GitHubRepositoryBenefitAccountNotConnected(GitHubError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "You don't have a GitHubRepositoryBenefit account connected."
        super().__init__(message)


class GitHubRepositoryBenefitExpiredAccessToken(GitHubError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "The access token is expired and no refresh token is available."
        super().__init__(message, 401)


class GitHubRepositoryRefreshTokenError(GitHubError):
    def __init__(self) -> None:
        message = (
            "An error occurred while refreshing the access token. "
            "Please reconnect your account."
        )
        super().__init__(message, 401)


class GitHubRepositoryBenefitNoAccess(GitHubError):
    def __init__(self) -> None:
        message = (
            "The user does not have access to this resource, or it's not bee installed"
        )
        super().__init__(message, 401)


class GitHubRepositoryBenefitUserService:
    async def create_oauth_account(
        self, session: AsyncSession, user: User, oauth2_token_data: OAuth2Token
    ) -> OAuthAccount:
        access_token = oauth2_token_data["access_token"]

        client = github.get_client(access_token=access_token)
        user_data = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(user_data)

        account_id = user_data.parsed_data.id
        account_username = user_data.parsed_data.login

        (
            account_email,
            email_is_verified,
        ) = await github_user_service.fetch_authenticated_user_primary_email(
            client=client
        )

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

        nested = await session.begin_nested()
        try:
            session.add(oauth_account)
            await nested.commit()
            await session.flush()
        except IntegrityError as e:
            await nested.rollback()
            raise ResourceAlreadyExists() from e

        return oauth_account

    async def update_oauth_account(
        self, session: AsyncSession, user: User, oauth2_token_data: OAuth2Token
    ) -> OAuthAccount:
        account = user.get_oauth_account(OAuthPlatform.github_repository_benefit)
        if account is None:
            raise GitHubRepositoryBenefitAccountNotConnected(user)

        account.access_token = oauth2_token_data["access_token"]
        account.expires_at = oauth2_token_data["expires_at"]
        account.refresh_token = oauth2_token_data["refresh_token"]

        client = github.get_client(access_token=account.access_token)
        user_data = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(user_data)

        (
            account_email,
            _,
        ) = await github_user_service.fetch_authenticated_user_primary_email(
            client=client
        )

        account.account_email = account_email
        account.account_username = user_data.parsed_data.login

        session.add(account)

        return account

    async def get_oauth_account(
        self, session: AsyncSession, user: User
    ) -> OAuthAccount:
        account = user.get_oauth_account(OAuthPlatform.github_repository_benefit)
        if account is None:
            raise GitHubRepositoryBenefitAccountNotConnected(user)

        if account.is_access_token_expired():
            if account.refresh_token is None:
                raise GitHubRepositoryBenefitExpiredAccessToken(user)

            try:
                refreshed_token_data = await github_oauth_client.refresh_token(
                    account.refresh_token
                )
            except RefreshTokenError as e:
                raise GitHubRepositoryRefreshTokenError() from e

            account.access_token = refreshed_token_data["access_token"]
            account.expires_at = refreshed_token_data["expires_at"]
            account.refresh_token = refreshed_token_data["refresh_token"]
            session.add(account)
            await session.flush()

            log.info(
                "github.auth.refresh.succeeded",
                user_id=account.user_id,
                platform=account.platform,
            )

        return account

    async def list_user_installations(
        self, oauth: OAuthAccount
    ) -> list["types.Installation"]:
        client = github.get_client(access_token=oauth.access_token)

        def map_installations_func(
            r: github.Response["types.UserInstallationsGetResponse200"],
        ) -> list["types.Installation"]:
            return r.parsed_data.installations

        installations: list[types.Installation] = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=map_installations_func,
        ):
            installations.append(install)

        return installations

    async def list_orgs_with_billing_plans(
        self,
        redis: Redis,
        oauth: OAuthAccount,
        installations: list["types.Installation"],
    ) -> list[GitHubInvitesBenefitOrganization]:
        res: list[GitHubInvitesBenefitOrganization] = []

        for i in installations:
            if b := await self.get_billing_plan(redis, oauth, i):
                res.append(b)

        return res

    async def get_billing_plan(
        self, redis: Redis, oauth: OAuthAccount, installation: "types.Installation"
    ) -> GitHubInvitesBenefitOrganization | None:
        if installation.account is None:
            return None
        if not isinstance(installation.account, SimpleUser):
            return None

        plan: (
            types.PublicUserPropPlan
            | types.PrivateUserPropPlan
            | types.OrganizationFullPropPlan
            | None
        ) = None

        if installation.target_type == "User":
            user_client = github.get_client(access_token=oauth.access_token)
            user_response = await user_client.rest.users.async_get_authenticated()
            if user_response.parsed_data and user_response.parsed_data.plan:
                plan = user_response.parsed_data.plan

        elif installation.target_type == "Organization":
            try:
                org_client = github.get_app_installation_client(installation.id)
                org_response = await org_client.rest.orgs.async_get(
                    installation.account.login
                )
                if (
                    org_response
                    and org_response.parsed_data
                    and org_response.parsed_data.plan
                ):
                    plan = org_response.parsed_data.plan
            except GitHubException as e:
                log.error(
                    "failed to get github org plan",
                    installation_id=installation.id,
                    organization=installation.account.login,
                    error_type=type(e).__name__,
                    error_message=str(e),
                    exc_info=True,
                )
            except Exception as e:
                log.error(
                    "unexpected error getting github org plan",
                    installation_id=installation.id,
                    organization=installation.account.login,
                    error_type=type(e).__name__,
                    error_message=str(e),
                    exc_info=True,
                )

        plan_name = plan.name if plan else ""

        return GitHubInvitesBenefitOrganization(
            name=installation.account.login,
            is_personal=installation.target_type == "User",
            plan_name=plan_name,
            is_free=plan_name.lower() == "free",
        )

    async def list_repositories(
        self,
        oauth: OAuthAccount,
        installations: list["types.Installation"],
    ) -> list[GitHubInvitesBenefitRepository]:
        client = github.get_client(access_token=oauth.access_token)

        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

        res: list[GitHubInvitesBenefitRepository] = []

        def map_repos_func(
            r: github.Response[
                "types.UserInstallationsInstallationIdRepositoriesGetResponse200"
            ],
        ) -> list["types.Repository"]:
            return r.parsed_data.repositories

        # get repos
        for install in installations:
            if install.account is None:
                continue
            if not isinstance(install.account, SimpleUser):
                continue

            async for repo in client.paginate(
                client.rest.apps.async_list_installation_repos_for_authenticated_user,
                map_func=map_repos_func,
                installation_id=install.id,
            ):
                res.append(
                    GitHubInvitesBenefitRepository(
                        repository_owner=install.account.login,
                        repository_name=repo.name,
                    )
                )

        return res

    async def get_repository_installation(
        self, *, owner: str, name: str
    ) -> "types.Installation | None":
        with github.get_app_client() as app_client:
            repo_install = await app_client.rest.apps.async_get_repo_installation(
                owner, name
            )
            if repo_install.status_code == 200:
                return repo_install.parsed_data
            return None

    async def user_has_access_to_repository(
        self, oauth: OAuthAccount, *, owner: str, name: str
    ) -> bool:
        installation = await self.get_repository_installation(owner=owner, name=name)
        if not installation:
            raise GitHubRepositoryBenefitNoAccess()

        all_user_installations = await self.list_user_installations(oauth)

        all_installation_ids = [i.id for i in all_user_installations]

        if installation.id in all_installation_ids:
            return True

        return False


github_repository_benefit_user_service = GitHubRepositoryBenefitUserService()

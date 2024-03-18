import time

import structlog
from githubkit import GitHub
from httpx_oauth.oauth2 import OAuth2Token

import polar.integrations.github.client as github
from polar.config import settings
from polar.exceptions import (
    BadRequest,
    IntegrityError,
    PolarError,
    ResourceAlreadyExists,
)
from polar.integrations.github import types
from polar.integrations.github_repository_benefit.schemas import (
    GitHubInvitesBenefitOrganization,
    GitHubInvitesBenefitRepository,
)
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class GitHubError(PolarError):
    ...


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

        nested = await session.begin_nested()
        try:
            session.add(oauth_account)
            await nested.commit()
            await session.flush()
        except IntegrityError as e:
            await nested.rollback()
            raise ResourceAlreadyExists() from e

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

    async def list_user_installations(
        self, oauth: OAuthAccount
    ) -> list[types.Installation]:
        client = github.get_client(access_token=oauth.access_token)

        def map_installations_func(
            r: github.Response[types.UserInstallationsGetResponse200],
        ) -> list[types.Installation]:
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
        oauth: OAuthAccount,
        installations: list[types.Installation],
    ) -> list[GitHubInvitesBenefitOrganization]:
        res: list[GitHubInvitesBenefitOrganization] = []

        for i in installations:
            if b := await self.get_billing_plan(oauth, i):
                res.append(b)

        return res

    async def get_billing_plan(
        self, oauth: OAuthAccount, installation: types.Installation
    ) -> GitHubInvitesBenefitOrganization | None:
        if installation.account is None:
            return None
        if not isinstance(installation.account, types.SimpleUser):
            return None

        plan: types.PublicUserPropPlan | types.PrivateUserPropPlan | types.OrganizationFullPropPlan | None = None

        if installation.target_type == "User":
            user_client = github.get_client(access_token=oauth.access_token)
            user_response = await user_client.rest.users.async_get_authenticated()
            if user_response.parsed_data and user_response.parsed_data.plan:
                plan = user_response.parsed_data.plan

        elif installation.target_type == "Organization":
            try:
                org_client = github.get_app_installation_client(
                    installation.id,
                    app=github.GitHubApp.repository_benefit,
                )
                org_response = await org_client.rest.orgs.async_get(
                    installation.account.login
                )
                if (
                    org_response
                    and org_response.parsed_data
                    and org_response.parsed_data.plan
                ):
                    plan = org_response.parsed_data.plan
            except Exception:
                log.error(
                    "failed to get github org plan", installation_id=installation.id
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
        installations: list[types.Installation],
    ) -> list[GitHubInvitesBenefitRepository]:
        client = github.get_client(access_token=oauth.access_token)

        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

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
                res.append(
                    GitHubInvitesBenefitRepository(
                        repository_owner=install.account.login,
                        repository_name=repo.name,
                    )
                )

        return res

    async def get_repository_installation(
        self,
        *,
        owner: str,
        name: str,
    ) -> types.Installation | None:
        app_client = github.get_app_client(app=github.GitHubApp.repository_benefit)

        repo_install = await app_client.rest.apps.async_get_repo_installation(
            owner, name
        )
        if repo_install.status_code == 200:
            return repo_install.parsed_data
        return None

    async def user_has_access_to_repository(
        self,
        oauth: OAuthAccount,
        *,
        owner: str,
        name: str,
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

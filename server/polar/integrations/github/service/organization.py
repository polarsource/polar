from datetime import datetime
from uuid import UUID

import structlog
from githubkit import (
    AppInstallationAuthStrategy,
    GitHub,
    TokenAuthStrategy,
)
from githubkit.exception import RequestFailed
from pydantic import BaseModel

from polar.enums import Platforms
from polar.exceptions import (
    InternalServerError,
    ResourceAlreadyExists,
    ResourceNotFound,
)
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.user import OAuthPlatform
from polar.organization.schemas import OrganizationCreateFromGitHubInstallation
from polar.organization.service import OrganizationService
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user.oauth_service import oauth_account_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .. import client as github
from .. import types
from .repository import github_repository

log: Logger = structlog.get_logger(service="GithubOrganizationService")


class Member(BaseModel):
    external_id: int
    username: str
    is_admin: bool
    avatar_url: str


class GithubOrganizationService(OrganizationService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Organization | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def fetch_installations(
        self, session: AsyncSession, locker: Locker, user: User
    ) -> list[types.Installation] | None:
        client = await github.get_user_client(session, locker, user)
        response = (
            await client.rest.apps.async_list_installations_for_authenticated_user()
        )
        github.ensure_expected_response(response)

        installations = response.parsed_data.installations
        log.debug(
            "github.installations.fetch.success",
            user_id=user.id,
            installation_count=len(installations),
        )
        if not installations:
            return None
        return installations

    async def install_from_user_browser(
        self, session: AsyncSession, locker: Locker, user: User, installation_id: int
    ) -> Organization | None:
        installations = await self.fetch_installations(session, locker, user)
        if not installations:
            raise Exception(f"no user installations found. id={installation_id}")

        # Ideally, we could fetch the specific resource with /apps/installation/{id}
        # instead. However, Github only provides the installation_id and no verification
        # token. Therefore, using it would expose us to CSRF risks, e.g malicious user
        # guessing other installation IDs to get connected to them.
        filtered = [i for i in installations if i.id == installation_id]
        if not filtered:
            raise Exception(
                f"user installation not found in filter. id={installation_id}"
            )

        org_installation = filtered.pop()

        organization = await self._install(session, org_installation)

        # TODO: Better error handling?
        # TODO: this is not true! user might not be admin!
        await self.add_user(session, organization, user, is_admin=True)

        return organization

    async def install_from_webhook(
        self, session: AsyncSession, installation: types.Installation
    ) -> Organization:
        return await self._install(session, installation)

    async def _install(
        self, session: AsyncSession, installation: types.Installation
    ) -> Organization:
        account = installation.account
        if account is None:
            raise Exception(
                f"installation without associated account. id={installation.id}"
            )
        elif not isinstance(account, types.SimpleUser):
            raise Exception(
                f"unsupported installation with an Enterprise account. id={installation.id}"
            )

        organization = await self.create_or_update(
            session,
            OrganizationCreateFromGitHubInstallation.from_github(
                user=account,
                installation=installation,
            ),
        )
        if not organization:
            raise Exception(
                f"failed to create organization from installation id={installation.id}"
            )

        # Un-delete if previously deleted
        if organization.deleted_at:
            organization.deleted_at = None
            session.add(organization)

        await self.populate_org_metadata(session, organization)

        await github_repository.install_for_organization(session, organization)

        enqueue_job("organization.post_install", organization_id=organization.id)

        enqueue_job(
            "github.organization.synchronize_members", organization_id=organization.id
        )

        return organization

    async def create_for_user(
        self,
        session: AsyncSession,
        locker: Locker,
        user: User,
    ) -> Organization:
        current_user_org = await user_organization_service.get_personal_org(
            session,
            platform=Platforms.github,
            user_id=user.id,
        )
        if current_user_org:
            log.info("user.create_github_org", found_existing=True)
            raise ResourceAlreadyExists("User already has a personal org")

        oauth = await oauth_account_service.get_by_platform_and_user_id(
            session, OAuthPlatform.github, user.id
        )
        if not oauth:
            log.error(
                "user.create_github_org",
                error="No GitHub OAuth account found",
                user_id=user.id,
            )
            raise ResourceNotFound()

        if not oauth.account_username:
            log.error(
                "user.create_github_org",
                error="oauth account has no username",
                user_id=user.id,
            )
            raise InternalServerError()

        if not user.avatar_url:
            raise InternalServerError("user has no avatar_url")

        # The organization may already exist
        # if it was synced from GitHub through issue funding
        org = await self.get_by_name(session, Platforms.github, oauth.account_username)
        if org is None:
            org = Organization(
                platform=Platforms.github,
                name=oauth.account_username,
                avatar_url=user.avatar_url,
                external_id=int(oauth.account_id),
                is_personal=True,
            )

        org.created_from_user_maintainer_upgrade = True
        session.add(org)
        await session.flush()

        await organization_service.add_user(
            session, organization=org, user=user, is_admin=True
        )

        # Invoked from authenticated user
        client = await github.get_refreshed_oauth_client(session, locker, oauth)
        await self._populate_github_user_metadata(session, client, org)

        enqueue_job("organization.post_user_upgrade", organization_id=org.id)
        return org

    async def suspend(
        self,
        session: AsyncSession,
        installation_id: int,
        suspended_by: int | None,
        suspended_at: datetime | None = None,
        external_user_id: int | None = None,
    ) -> bool:
        org = await self.get_by(session, installation_id=installation_id)
        if not org:
            return False

        if suspended_at is None:
            suspended_at = utc_now()

        org.installation_suspended_at = suspended_at
        org.installation_suspended_by = suspended_by

        session.add(org)

        return True

    async def unsuspend(
        self,
        session: AsyncSession,
        installation_id: int,
        external_user_id: int | None = None,
    ) -> bool:
        org = await self.get_by(session, installation_id=installation_id)
        if not org:
            return False

        org.installation_suspended_at = None
        org.installation_suspended_by = None

        session.add(org)

        return True

    async def remove(self, session: AsyncSession, org_id: UUID) -> None:
        # mark all repositories as deleted
        repos = await github_repository.list_by(session, org_ids=[org_id])
        for repo in repos:
            await github_repository.soft_delete(session, repo.id)

        organization = await self.get(session, org_id)
        if organization is not None:
            organization.installation_id = None
            organization.deleted_at = utc_now()
            session.add(organization)
            await session.commit()

    async def populate_org_metadata(
        self, session: AsyncSession, org: Organization
    ) -> None:
        if not org.installation_id:
            return None

        client = github.get_app_installation_client(org.safe_installation_id)
        if org.is_personal:
            return await self._populate_github_user_metadata(session, client, org)

        return await self._populate_github_org_metadata(session, client, org)

    async def _populate_github_org_metadata(
        self,
        session: AsyncSession,
        client: GitHub[AppInstallationAuthStrategy],
        org: Organization,
    ) -> None:
        try:
            github_org = await client.rest.orgs.async_get(org.name)
        except RequestFailed as e:
            # org not found
            if e.response.status_code == 404:
                return
            else:
                raise e

        gh = github_org.parsed_data

        org.bio = gh.description
        org.pretty_name = gh.name if gh.name else None
        org.company = gh.company if gh.company else None
        org.blog = gh.blog if gh.blog else None
        org.location = gh.location if gh.location else None
        org.email = gh.email if gh.email else None
        org.twitter_username = gh.twitter_username if gh.twitter_username else None

        session.add(org)

    async def _populate_github_user_metadata(
        self,
        session: AsyncSession,
        client: GitHub[AppInstallationAuthStrategy] | GitHub[TokenAuthStrategy],
        org: Organization,
    ) -> None:
        try:
            github_org = await client.rest.users.async_get_by_username(org.name)
        except RequestFailed as e:
            # org not found
            if e.response.status_code == 404:
                return
            else:
                raise e

        gh = github_org.parsed_data

        org.bio = gh.bio
        org.pretty_name = gh.name
        org.company = gh.company
        org.blog = gh.blog
        org.location = gh.location
        org.email = gh.email
        org.twitter_username = gh.twitter_username if gh.twitter_username else None

        session.add(org)


github_organization = GithubOrganizationService(Organization)

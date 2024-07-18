from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import structlog
from githubkit import AppInstallationAuthStrategy, GitHub, TokenAuthStrategy
from githubkit.exception import RequestFailed

from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import PolarRequestValidationError
from polar.external_organization.schemas import (
    ExternalOrganizationCreateFromGitHubInstallation,
    ExternalOrganizationCreateFromGitHubUser,
)
from polar.external_organization.service import ExternalOrganizationService
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import ExternalOrganization, User
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession

from .. import client as github
from .. import types
from ..schemas import InstallationCreate
from .repository import github_repository

log: Logger = structlog.get_logger(service="GithubOrganizationService")


class GithubOrganizationService(ExternalOrganizationService):
    async def list_installed(
        self, session: AsyncSession
    ) -> Sequence[ExternalOrganization]:
        stmt = sql.select(ExternalOrganization).where(
            ExternalOrganization.deleted_at.is_(None),
            ExternalOrganization.installation_id.is_not(None),
        )
        res = await session.execute(stmt)
        return res.scalars().all()

    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> ExternalOrganization | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def fetch_installations(
        self, session: AsyncSession, locker: Locker, user: User
    ) -> list[types.Installation]:
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
        return installations

    async def install(
        self,
        session: AsyncSession,
        locker: Locker,
        authz: Authz,
        user: User,
        installation_create: InstallationCreate,
    ) -> ExternalOrganization:
        # Ideally, we could fetch the specific resource with /apps/installation/{id}
        # instead. However, Github only provides the installation_id and no verification
        # token. Therefore, using it would expose us to CSRF risks, e.g malicious user
        # guessing other installation IDs to get connected to them.
        installations = await self.fetch_installations(session, locker, user)
        for installation in installations:
            if installation.id == installation_create.installation_id:
                break
        else:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("installation_id",),
                        "msg": "GitHub installation does not exist.",
                        "type": "value_error",
                        "input": installation_create.installation_id,
                    }
                ]
            )

        organization = await organization_service.get(
            session, installation_create.organization_id
        )

        if organization is None or not await authz.can(
            user, AccessType.write, organization
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("organization_id",),
                        "msg": "Organization does not exist.",
                        "type": "value_error",
                        "input": installation_create.organization_id,
                    }
                ]
            )

        external_organization = await self.create_or_update_from_installation(
            session, installation
        )
        if (
            external_organization.organization_id is not None
            and external_organization.organization_id != organization.id
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("installation_id",),
                        "msg": (
                            "This GitHub organization is "
                            "already connected to another organization."
                        ),
                        "type": "value_error",
                        "input": installation_create.organization_id,
                    }
                ]
            )

        external_organization.organization_id = organization.id
        session.add(external_organization)
        await session.flush()

        return external_organization

    async def create_or_update_from_installation(
        self, session: AsyncSession, installation: types.Installation
    ) -> ExternalOrganization:
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
            ExternalOrganizationCreateFromGitHubInstallation.from_github(
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

        return organization

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
        self, session: AsyncSession, org: ExternalOrganization
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
        org: ExternalOrganization,
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
        org: ExternalOrganization,
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

    async def create_or_update(
        self,
        session: AsyncSession,
        r: ExternalOrganizationCreateFromGitHubInstallation
        | ExternalOrganizationCreateFromGitHubUser,
    ) -> ExternalOrganization:
        update_keys = r.__annotations__.keys()

        insert_stmt = sql.insert(ExternalOrganization).values(**r.model_dump())

        stmt = (
            insert_stmt.on_conflict_do_update(
                index_elements=[ExternalOrganization.external_id],
                set_={k: getattr(insert_stmt.excluded, k) for k in update_keys},
            )
            .returning(ExternalOrganization)
            .execution_options(populate_existing=True)
        )

        res = await session.execute(stmt)
        await session.commit()
        org = res.scalars().one()

        return org


github_organization = GithubOrganizationService(ExternalOrganization)

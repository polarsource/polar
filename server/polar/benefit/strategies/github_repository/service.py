import contextlib
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, cast

import structlog
from githubkit.exception import (
    RateLimitExceeded,
    RequestError,
    RequestFailed,
    RequestTimeout,
)

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.integrations.github import client as github
from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.logging import Logger
from polar.models import Benefit, Customer, Organization, User
from polar.models.customer import CustomerOAuthPlatform

from ..base.service import (
    BenefitActionRequiredError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceProtocol,
)
from .properties import (
    BenefitGitHubRepositoryProperties,
    BenefitGrantGitHubRepositoryProperties,
)

if TYPE_CHECKING:
    from githubkit import AppInstallationAuthStrategy, GitHub
    from githubkit.versions.latest.models import RepositoryInvitation


log: Logger = structlog.get_logger()


class BenefitGitHubRepositoryService(
    BenefitServiceProtocol[
        BenefitGitHubRepositoryProperties, BenefitGrantGitHubRepositoryProperties
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantGitHubRepositoryProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantGitHubRepositoryProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            user_id=str(customer.id),
        )
        bound_logger.debug("Grant benefit")

        async with self._get_github_app_client(benefit) as client:
            properties = self._get_properties(benefit)
            repository_owner = properties["repository_owner"]
            repository_name = properties["repository_name"]
            permission = properties["permission"]

            # If we already granted this benefit, make sure we revoke the previous config
            if update and grant_properties:
                bound_logger.debug("Grant benefit update")
                previous_repository_owner = grant_properties.get("repository_owner")
                previous_repository_name = grant_properties.get("repository_name")
                previous_permission = grant_properties.get("permission")
                granted_account_id = grant_properties.get("granted_account_id")
                # The repository, the permission or the account changed: revoke first
                if (
                    (
                        previous_repository_owner is not None
                        and repository_owner != previous_repository_owner
                    )
                    or (
                        previous_repository_name is not None
                        and repository_name != previous_repository_name
                    )
                    or (
                        previous_permission is not None
                        and permission != previous_permission
                    )
                    or (
                        granted_account_id is not None
                        and grant_properties.get("account_id") != granted_account_id
                    )
                ):
                    bound_logger.debug(
                        "Revoke before granting because repository, permission or account changed"
                    )
                    await self.revoke(
                        benefit, customer, grant_properties, attempt=attempt
                    )

            if (account_id := grant_properties.get("account_id")) is None:
                raise BenefitActionRequiredError(
                    "The customer needs to connect their GitHub account"
                )

            oauth_account = customer.get_oauth_account(
                account_id, CustomerOAuthPlatform.github
            )

            if oauth_account is None or oauth_account.account_username is None:
                raise BenefitActionRequiredError(
                    "The customer needs to connect their GitHub account"
                )

            try:
                await client.rest.repos.async_add_collaborator(
                    owner=repository_owner,
                    repo=repository_name,
                    username=oauth_account.account_username,
                    data={"permission": permission},
                )
            except RateLimitExceeded as e:
                raise BenefitRetriableError(int(e.retry_after.total_seconds())) from e
            except RequestFailed as e:
                if e.response.is_client_error:
                    raise
                raise BenefitRetriableError() from e
            except (RequestTimeout, RequestError) as e:
                raise BenefitRetriableError() from e

            bound_logger.debug("Benefit granted")

            # Store repository, permission and account ID to compare on update
            return {
                **grant_properties,
                "repository_owner": repository_owner,
                "repository_name": repository_name,
                "permission": permission,
                "granted_account_id": account_id,
            }

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantGitHubRepositoryProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantGitHubRepositoryProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantGitHubRepositoryProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantGitHubRepositoryProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
        )

        async with self._get_github_app_client(benefit) as client:
            properties = self._get_properties(benefit)
            repository_owner = properties["repository_owner"]
            repository_name = properties["repository_name"]

            if (account_id := grant_properties.get("granted_account_id")) is None:
                raise BenefitActionRequiredError(
                    "The benefit was never granted to the customer"
                )

            oauth_account = customer.get_oauth_account(
                account_id, CustomerOAuthPlatform.github
            )

            if oauth_account is None or oauth_account.account_username is None:
                raise BenefitActionRequiredError(
                    "The customer needs to connect their GitHub account"
                )

            invitation = await self._get_invitation(
                client,
                repository_owner=repository_owner,
                repository_name=repository_name,
                user_id=int(oauth_account.account_id),
            )
            if invitation is not None:
                bound_logger.debug("Invitation not yet accepted, removing it")
                revoke_request = client.rest.repos.async_delete_invitation(
                    repository_owner, repository_name, invitation.id
                )
            else:
                bound_logger.debug("Invitation not found, removing the user")
                revoke_request = client.rest.repos.async_remove_collaborator(
                    repository_owner, repository_name, oauth_account.account_username
                )

            try:
                await revoke_request
            except RateLimitExceeded as e:
                raise BenefitRetriableError(int(e.retry_after.total_seconds())) from e
            except RequestFailed as e:
                if e.response.is_client_error:
                    raise
                raise BenefitRetriableError() from e
            except (RequestTimeout, RequestError) as e:
                raise BenefitRetriableError() from e

            bound_logger.debug("Benefit revoked")

            # Keep account_id in case we need to re-grant later
            return {
                "account_id": grant_properties.get("account_id"),
            }

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitGitHubRepositoryProperties
    ) -> bool:
        new_properties = self._get_properties(benefit)
        return (
            new_properties["repository_owner"]
            != previous_properties["repository_owner"]
            or new_properties["repository_name"]
            != previous_properties["repository_name"]
            or new_properties["permission"] != previous_properties["permission"]
        )

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitGitHubRepositoryProperties:
        if is_organization(auth_subject):
            # TODO: Support organization tokens
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_auth_subject",
                        "msg": (
                            "We do not yet support creating this benefit "
                            "with an organization token."
                        ),
                        "loc": ("repository_owner",),
                        "input": properties["repository_owner"],
                    }
                ]
            )

        assert is_user(auth_subject)
        user = auth_subject.subject

        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]

        oauth = await github_repository_benefit_user_service.get_oauth_account(
            self.session, user
        )
        if not oauth:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_user_auth",
                        "msg": "You have not authenticated with the github_repository_benefit app",
                        "loc": ("repository_owner",),
                        "input": repository_owner,  # ?
                    }
                ]
            )

        # check that use has access to the app installed on this repository
        has_access = (
            await github_repository_benefit_user_service.user_has_access_to_repository(
                oauth, owner=repository_owner, name=repository_name
            )
        )

        if not has_access:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "no_repository_acccess",
                        "msg": "You don't have access to this repository.",
                        "loc": ("repository_name",),
                        "input": repository_name,
                    }
                ]
            )

        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner, name=repository_name
            )
        )
        if not installation:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "no_repository_installation_found",
                        "msg": "Could not find a installation for this repository.",
                        "loc": ("repository_name",),
                        "input": repository_name,
                    }
                ]
            )

        plan = await github_repository_benefit_user_service.get_billing_plan(
            self.redis, oauth, installation
        )
        if not plan or plan.is_personal:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "personal_organization_repository",
                        "msg": "For security reasons, "
                        "repositories on personal organizations are not supported.",
                        "loc": ("repository_name",),
                        "input": repository_name,
                    }
                ]
            )

        return cast(
            BenefitGitHubRepositoryProperties,
            {
                **properties,
            },
        )

    async def _get_invitation(
        self,
        client: "GitHub[Any]",
        *,
        repository_owner: str,
        repository_name: str,
        user_id: int,
    ) -> "RepositoryInvitation | None":
        async for invitation in client.paginate(
            client.rest.repos.async_list_invitations,
            owner=repository_owner,
            repo=repository_name,
        ):
            if invitation.invitee and invitation.invitee.id == user_id:
                return invitation

        return None

    @contextlib.asynccontextmanager
    async def _get_github_app_client(
        self, benefit: Benefit
    ) -> AsyncIterator["GitHub[AppInstallationAuthStrategy]"]:
        properties = self._get_properties(benefit)
        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]
        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner, name=repository_name
            )
        )
        assert installation is not None
        async with github.get_app_installation_client(installation.id) as client:
            yield client

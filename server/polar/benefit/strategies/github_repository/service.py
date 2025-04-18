from typing import TYPE_CHECKING, Any, cast

import structlog
from githubkit import AppInstallationAuthStrategy, GitHub
from githubkit.exception import RateLimitExceeded, RequestError, RequestTimeout

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.integrations.github import client as github
from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.logging import Logger
from polar.models import Benefit, Customer, Organization, User
from polar.models.customer import CustomerOAuthPlatform
from polar.posthog import posthog
from polar.worker import compute_backoff

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

        client = await self._get_github_app_client(benefit)

        properties = self._get_properties(benefit)
        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]
        permission = properties["permission"]

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

        # If we already granted this benefit, make sure we revoke the previous config
        if update and grant_properties:
            bound_logger.debug("Grant benefit update")
            invitation = await self._get_invitation(
                client,
                repository_owner=repository_owner,
                repository_name=repository_name,
                user_id=int(oauth_account.account_id),
            )
            # The repository changed, or the invitation is still pending: revoke
            if (
                repository_owner != grant_properties.get("repository_owner")
                or repository_name != grant_properties.get("repository_name")
                or invitation is not None
            ):
                await self.revoke(benefit, customer, grant_properties, attempt=attempt)
            # The permission changed, and the invitation is already accepted
            elif permission != grant_properties.get("permission"):
                # The permission change will be handled by the add_collaborator call
                pass

        try:
            await client.rest.repos.async_add_collaborator(
                owner=repository_owner,
                repo=repository_name,
                username=oauth_account.account_username,
                data={"permission": permission},
            )
        except RateLimitExceeded as e:
            raise BenefitRetriableError(int(e.retry_after.total_seconds())) from e
        except (RequestTimeout, RequestError) as e:
            raise BenefitRetriableError(compute_backoff(attempt)) from e

        bound_logger.debug("Benefit granted")

        # Store repository and permission to compare on update
        return {
            **grant_properties,
            "repository_owner": repository_owner,
            "repository_name": repository_name,
            "permission": permission,
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

        client = await self._get_github_app_client(benefit)

        properties = self._get_properties(benefit)
        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]

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
        except (RequestTimeout, RequestError) as e:
            raise BenefitRetriableError(compute_backoff(attempt)) from e

        bound_logger.debug("Benefit revoked")

        return {}

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

        if posthog.client and not posthog.client.feature_enabled(
            "github-benefit-personal-org", user.posthog_distinct_id
        ):
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
        client: github.GitHub[Any],
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

    async def _get_github_app_client(
        self, benefit: Benefit
    ) -> GitHub[AppInstallationAuthStrategy]:
        properties = self._get_properties(benefit)
        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]
        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner, name=repository_name
            )
        )
        assert installation is not None
        return github.get_app_installation_client(installation.id)
